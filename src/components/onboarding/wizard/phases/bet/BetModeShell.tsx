/**
 * BetModeShell — ORQUESTRADOR INTERNO da TRIAGEM do wizard unificado.
 *
 * ⚠️ NÃO É UM WRAPPER. Contém:
 *  - Reducer próprio do estado da triagem (identity → who → city → ...)
 *  - Lógica de pontos/dopamine HUD
 *  - Persistência atômica em profiles + providers (PF/PJ)
 *  - Fast-pass do cliente (marca onboarding_completed e redireciona ao ?next=)
 *  - Handoff interno para o orquestrador principal (OnboardingV2Shell) quando
 *    o usuário é profissional, via prop `onInternalHandoff`.
 *
 * É consumido EXCLUSIVAMENTE por `WizardShell` sob o alias `TriageOrchestrator`.
 * Não exportar publicamente, não usar fora do WizardShell, não inlinar — a
 * separação existe para isolar o reducer e os efeitos de persistência.
 *
 * Filosofia do fluxo:
 *  - Porta única do cadastro: /triagem e o A/B antigo foram removidos.
 *  - Cliente: fast-pass, marca onboarding_completed=true e redireciona ao ?next=.
 *  - Profissional: completa identificação básica e segue no fluxo único para
 *    criar o 1º serviço sem repetir nome, WhatsApp e cidade já capturados.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';
import { normalizeProviderPayload } from '@/lib/providerPayload';
import { safeWizardSave, logWizardError } from '@/lib/wizardErrorGuard';
import { useSeoHead } from '@/hooks/useSeoHead';
import { betDraftPayloadSchema, providerWritePayloadSchema, safeParse } from '@/lib/wizardSchemas';

import PointsHud from './PointsHud';
import PhaseIdentity from './PhaseIdentity';
import PhaseWho from './PhaseWho';
import PhaseClientCity from './PhaseClientCity';
import PhaseProKind from './PhaseProKind';
import PhaseProDocument from './PhaseProDocument';
import PhaseProLocation from './PhaseProLocation';
import PhaseCelebration from './PhaseCelebration';

import { initialBetState, type BetState, type BetIntent, type BetPhase } from './types';
import { setOnboardingIntent } from '../v2/telemetry';
import { useBetDraft, loadBetDraft, clearBetDraft } from './useBetDraft';
import { useBetRemoteDraft, fetchRemoteBetDraft, clearRemoteBetDraft } from './useBetRemoteDraft';

/** Ordem das fases — usado para resolver o "Voltar" global em uma fase anterior. */
const BET_BACK_MAP: Partial<Record<BetPhase, BetPhase>> = {
  who: 'identity',
  client_city: 'who',
  pro_kind: 'who',
  pro_document: 'pro_kind',
  pro_location: 'pro_kind',
};

type Action =
  | { type: 'PATCH'; patch: Partial<BetState> }
  | { type: 'GOTO'; phase: BetPhase }
  | { type: 'POINTS'; n: number };

function reducer(s: BetState, a: Action): BetState {
  switch (a.type) {
    case 'PATCH': return { ...s, ...a.patch };
    case 'GOTO': return { ...s, phase: a.phase };
    case 'POINTS': return { ...s, points: s.points + a.n };
    default: return s;
  }
}

const PHASE_LABELS: Record<BetPhase, string> = {
  identity: 'Identificação',
  who: 'Quem é você',
  client_city: 'Sua cidade',
  pro_kind: 'Tipo de conta',
  pro_document: 'Documento',
  pro_location: 'Cidade base',
  celebration: 'Conquista',
  done: 'Concluído',
};

const PHASE_PROGRESS: Record<BetPhase, number> = {
  identity: 0.15,
  who: 0.35,
  client_city: 0.85,
  pro_kind: 0.55,
  pro_document: 0.75,
  pro_location: 0.9,
  celebration: 1,
  done: 1,
};

// IDs reais das contas em public.account_types
const ACCOUNT_TYPE_ID_PF = '61f51480-d8c2-4c78-8f44-6a17e8b6b968'; // Profissional Autônomo
const ACCOUNT_TYPE_ID_PJ = '4e322d19-c999-4563-ac63-45ccefd78736'; // Empresa / Agência

interface BetModeShellProps {
  /**
   * Callback do WizardShell unificado para o handoff Triagem →
   * Criação de Serviço & Perfil, em memória (sem trocar de URL).
   * Como /cadastro-bet e /onboarding-v2 deixaram de existir como rotas,
   * é o único caminho válido pós-triagem para profissionais.
   */
  onInternalHandoff?: (state: BetState) => void;
  /**
   * Reporta a fase interna corrente para o WizardShell exibir a barra
   * de progresso global (Consolidação Fase 1).
   */
  onPhaseChange?: (phase: BetPhase) => void;
}

export default function BetModeShell({ onInternalHandoff, onPhaseChange }: BetModeShellProps = {}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const { user, profile, refetchProfile } = useAuth();
  const [state, dispatch] = useReducer(reducer, undefined as unknown as BetState, () => loadBetDraft());

  useSeoHead({ title: 'Cadastro express', description: 'Cadastro rápido para começar agora.', noindex: true });

  // Persiste rascunho local — preserva nome/WhatsApp/cidade/bairro através de
  // reload, troca de aba e do botão "Voltar" do navegador.
  useBetDraft(state);

  // Hidratação remota (cross-device): se o user tem draft no banco mais recente
  // que o local, mescla. Fail-soft. `remoteReady` libera persistência remota.
  const [remoteReady, setRemoteReady] = useState(false);
  const hydratedFromRemote = useRef(false);
  useEffect(() => {
    if (!user?.id || hydratedFromRemote.current) return;
    hydratedFromRemote.current = true;
    void (async () => {
      try {
        const remote = await fetchRemoteBetDraft(user.id);
        if (remote?.payload) {
          const parsed = safeParse(betDraftPayloadSchema, remote.payload);
          if (parsed.ok) {
            // Merge não-destrutivo: só preenche campos vazios localmente.
            const incoming = parsed.data as Partial<BetState>;
            const patchObj: Partial<BetState> = {};
            (Object.keys(incoming) as Array<keyof BetState>).forEach((k) => {
              const cur = (state as any)[k];
              const inc = (incoming as any)[k];
              const isEmpty = cur === '' || cur === null || cur === undefined;
              if (isEmpty && inc !== undefined && inc !== null && inc !== '') {
                (patchObj as any)[k] = inc;
              }
            });
            if (Object.keys(patchObj).length > 0) dispatch({ type: 'PATCH', patch: patchObj });
          }
        }
      } finally {
        setRemoteReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persistência remota (debounced) — só liga após hidratação inicial.
  useBetRemoteDraft(state, user?.id, { ready: remoteReady });

  // Reporta mudanças de fase para a barra de progresso global do WizardShell.
  useEffect(() => {
    onPhaseChange?.(state.phase);
  }, [state.phase, onPhaseChange]);

  // Pré-preenche com o que já existe (ex: nome do Google) + hidrata HUD com saldo real do banco.
  useEffect(() => {
    if (!profile) return;
    const dbPoints = Number((profile as any).engagement_points ?? 0);
    dispatch({ type: 'PATCH', patch: {
      full_name: state.full_name || profile.full_name || '',
      whatsapp: state.whatsapp || (profile as any).whatsapp || '',
      city: state.city || profile.city || '',
      state: state.state || profile.state || '',
      // Hidrata o contador uma única vez com o total acumulado real (apenas se ainda zero).
      points: state.points === 0 && dbPoints > 0 ? dbPoints : state.points,
    }});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Listener do "Voltar" global emitido pelo WizardShell + suporte ao botão
  // "Voltar" do NAVEGADOR via history.pushState/popstate. Cada mudança de fase
  // empurra um state com a fase atual; o popstate restaura a fase anterior.
  const lastPushedPhase = useRef<BetPhase | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (state.phase === 'done') return;
    // Pula a primeira fase (já está na URL atual). Apenas push em mudanças.
    if (lastPushedPhase.current === null) {
      lastPushedPhase.current = state.phase;
      // Substitui o state atual com a fase para o popstate poder ler.
      try { window.history.replaceState({ wizardPhase: state.phase }, ''); } catch {}
      return;
    }
    if (lastPushedPhase.current !== state.phase) {
      lastPushedPhase.current = state.phase;
      try { window.history.pushState({ wizardPhase: state.phase }, ''); } catch {}
    }
  }, [state.phase]);

  useEffect(() => {
    function handleBack() {
      const prev = BET_BACK_MAP[state.phase];
      if (prev) dispatch({ type: 'GOTO', phase: prev });
    }
    function handlePopState(ev: PopStateEvent) {
      const target = ev.state?.wizardPhase as BetPhase | undefined;
      if (target && target !== state.phase) {
        // Restaura a fase do history sem empurrar nova entrada.
        lastPushedPhase.current = target;
        dispatch({ type: 'GOTO', phase: target });
      } else {
        // Fallback: comporta-se como o "Voltar" do wizard.
        const prev = BET_BACK_MAP[state.phase];
        if (prev) {
          lastPushedPhase.current = prev;
          dispatch({ type: 'GOTO', phase: prev });
        }
      }
    }
    window.addEventListener('wizard:request-back', handleBack as EventListener);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('wizard:request-back', handleBack as EventListener);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [state.phase]);

  const patch = (p: Partial<BetState>) => dispatch({ type: 'PATCH', patch: p });
  const goto = (phase: BetPhase) => dispatch({ type: 'GOTO', phase });
  const addPoints = (n: number) => dispatch({ type: 'POINTS', n });

  async function finishRh() {
    if (!user) { toast.error('Faça login antes de continuar'); return; }
    // Defesa: nome/WhatsApp deveriam estar preenchidos pela fase 'identity'.
    // Se por qualquer motivo estiverem vazios, devolve para corrigir.
    if (!state.full_name?.trim() || !state.whatsapp?.trim()) {
      toast.error('Preencha nome e WhatsApp antes de continuar.');
      goto('identity');
      return;
    }
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: state.full_name.trim(),
          whatsapp: state.whatsapp,
          city: state.city || null,
          state: state.state || null,
          profile_type: 'rh',
          onboarding_step: 5,
          onboarding_completed: true,
        })
        .eq('id', user.id);
      if (error) throw error;
      await addSessionPointsToProfile();
      await refetchProfile?.();
      clearBetDraft();
      void clearRemoteBetDraft(user.id);
      navigate('/dashboard/agencia', { replace: true });
    } catch (err: any) {
      logWizardError({ phase: 'phase1_contact', userId: user?.id, error: err, variant: 'v1', context: { action: 'finish_rh' } });
      toast.error(err?.message || 'Erro ao salvar cadastro da agência', {
        action: { label: 'Tentar novamente', onClick: () => { void finishRh(); } },
      });
    }
  }

  async function finishSponsor() {
    if (!user) { toast.error('Faça login antes de continuar'); return; }
    if (!state.full_name?.trim() || !state.whatsapp?.trim()) {
      toast.error('Preencha nome e WhatsApp antes de continuar.');
      goto('identity');
      return;
    }
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: state.full_name.trim(),
          whatsapp: state.whatsapp,
          city: state.city || null,
          state: state.state || null,
          profile_type: 'client',
          onboarding_step: 5,
          onboarding_completed: true,
        })
        .eq('id', user.id);
      if (error) throw error;
      await addSessionPointsToProfile();
      await refetchProfile?.();
      clearBetDraft();
      void clearRemoteBetDraft(user.id);
      navigate('/quero-ser-patrocinador', { replace: true });
    } catch (err: any) {
      logWizardError({ phase: 'phase1_contact', userId: user?.id, error: err, variant: 'v1', context: { action: 'finish_sponsor' } });
      toast.error(err?.message || 'Erro ao iniciar fluxo de patrocinador', {
        action: { label: 'Tentar novamente', onClick: () => { void finishSponsor(); } },
      });
    }
  }

  function pickIntent(intent: BetIntent) {
    patch({ intent });
    // Persiste intent real (sticky por sessão) para auto-injeção em toda telemetria.
    setOnboardingIntent(
      intent === 'professional' || intent === 'client' || intent === 'rh' ? intent : null,
    );
    if (intent === 'professional') {
      goto('pro_kind');
      return;
    }
    if (intent === 'client') {
      goto('client_city');
      return;
    }
    if (intent === 'rh') {
      void finishRh();
      return;
    }
    void finishSponsor();
  }

  /**
   * Após escolher PF/PJ, pular direto para cidade base.
   * O CPF/CNPJ é coletado APÓS o 1º serviço estar criado (Phase4Document),
   * conforme reordenação do fluxo linear (cadastro completo só depois do serviço).
   */
  function afterProKind() {
    goto('pro_location');
  }

  /** Soma incremento de pontos ganhos NESTA sessão ao saldo do banco. */
  async function addSessionPointsToProfile() {
    try {
      const dbPoints = Number((profile as any)?.engagement_points ?? 0);
      // state.points pode já estar hidratado com dbPoints — garante que só soma o delta.
      const delta = Math.max(0, state.points - dbPoints);
      if (delta <= 0) return;
      await (supabase as any)
        .from('profiles')
        .update({ engagement_points: dbPoints + delta })
        .eq('id', user!.id);
    } catch { /* noop */ }
  }

  /** Cliente fast-pass: salva, libera o gate e redireciona DIRETO ao destino — sem tela extra. */
  async function finishClient() {
    if (!user) { toast.error('Faça login antes de continuar'); return; }
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: state.full_name.trim(),
          whatsapp: state.whatsapp,
          city: state.city,
          state: state.state,
          // Bairro do cliente (opcional) — refina a busca por proximidade.
          neighborhood: (state.neighborhood || '').trim() || null,
          profile_type: 'client',
          onboarding_step: 5,
          onboarding_completed: true,
        })
        .eq('id', user.id);
      if (error) throw error;
      await addSessionPointsToProfile();
      await refetchProfile?.();
      toast.success(`+${state.points} pts conquistados!`, { description: 'Bem-vindo. Levando você ao destino…' });
      clearBetDraft();
      void clearRemoteBetDraft(user.id);
      navigate(next, { replace: true });
    } catch (err: any) {
      logWizardError({ phase: 'phase1_contact', userId: user?.id, error: err, variant: 'v1', context: { action: 'finish_client' } });
      toast.error(err?.message || 'Erro ao salvar cadastro', {
        action: { label: 'Tentar novamente', onClick: () => { void finishClient(); } },
      });
    }
  }

  /** Profissional: salva profile + provider mínimo, depois empurra para V2 (1º serviço). */
  async function finishPro() {
    if (!user) { toast.error('Faça login antes de continuar'); return; }
    try {
      const isPj = state.pro_kind === 'pj';
      const docDigits = (state.document || '').replace(/\D/g, '');
      const cpf = !isPj && docDigits.length === 11 ? docDigits : null;
      const cnpj = isPj && docDigits.length === 14 ? docDigits : null;
      const taxIdKind = cpf ? 'cpf' : cnpj ? 'cnpj' : null;
      const taxIdValue = cpf || cnpj;

      // ---- profiles: identidade + tipo de conta correto + tax_id (PF/PJ) ----
      const profilePatch: Record<string, unknown> = {
        full_name: state.full_name.trim(),
        whatsapp: state.whatsapp,
        city: state.city,
        state: state.state,
        profile_type: 'provider',
        onboarding_step: 3, // V2 termina o serviço
        account_type_id: isPj ? ACCOUNT_TYPE_ID_PJ : ACCOUNT_TYPE_ID_PF,
      };
      if (taxIdValue) {
        profilePatch.tax_id = taxIdValue;
        profilePatch.tax_id_kind = taxIdKind;
        profilePatch.tax_id_last4 = taxIdValue.slice(-4);
      }

      const { error: pErr } = await (supabase as any)
        .from('profiles')
        .update(profilePatch)
        .eq('id', user.id);
      if (pErr) throw pErr;

      // ---- providers: documento na coluna certa + business_name (PF e PJ) + neighborhood ----
      // FRONT-END SYNC: business_name é preenchido AGORA com o nome do usuário
      // (PF) ou da empresa (PJ). Não dependemos exclusivamente do trigger DB —
      // assim o card aparece corretamente mesmo se o trigger demorar a propagar.
      const fullName = state.full_name.trim();
      const companyName = (state.company_name || '').trim();
      const businessName = isPj ? (companyName || fullName) : fullName;
      const providerPayload = normalizeProviderPayload({
        user_id: user.id,
        account_type: isPj ? 'company' : 'autonomous',
        business_name: businessName || null,
        legal_name: isPj ? (companyName || fullName) : fullName,
        cpf,
        cnpj,
        whatsapp: state.whatsapp,
        phone: state.whatsapp,
        city: state.city,
        state: state.state,
        neighborhood: (state.neighborhood || '').trim(),
        description: '',
        // PJ — endereço institucional (opcional). normalizeProviderPayload
        // remove silenciosamente para PF e sanitiza para PJ.
        ...(isPj
          ? {
              street: state.street,
              street_number: state.street_number,
              complement: state.complement,
              postal_code: state.postal_code,
              show_full_address: state.show_full_address === true,
            }
          : {}),
      });

      // Validação Zod ANTES de bater no banco — falha cedo e clara.
      const validation = safeParse(providerWritePayloadSchema, providerPayload);
      if (validation.ok === false) {
        toast.error('Dados incompletos', { description: validation.message });
        logWizardError({
          phase: 'phase1_contact', userId: user.id, error: new Error('zod_validation_failed'),
          variant: 'v1', context: { action: 'bet_finish_pro_validation', issues: validation.issues.slice(0, 3) },
        });
        return;
      }

      const upsertResult = await safeWizardSave({
        phase: 'phase1_contact',
        userId: user.id,
        variant: 'v1',
        friendlyMessage: 'Não consegui finalizar seu cadastro',
        context: { isPj, hasDoc: !!taxIdValue, action: 'bet_finish_pro' },
        onRetry: () => { void finishPro(); },
        fn: async () => {
          const { error } = await (supabase as any)
            .from('providers').upsert(providerPayload, { onConflict: 'user_id' });
          if (error) {
            // Observabilidade: registra o motivo REAL do upsert antes do fallback.
            // Sem isso, o usuário só vê "erro genérico" e perdemos a constraint culpada.
            console.warn('[BetModeShell] providers.upsert falhou — caindo para insert puro', {
              code: (error as any).code,
              message: (error as any).message,
              details: (error as any).details,
              hint: (error as any).hint,
            });
            logWizardError({
              phase: 'phase1_contact',
              userId: user?.id,
              error,
              variant: 'v1',
              context: { action: 'bet_finish_pro_upsert_failed', isPj, hasDoc: !!taxIdValue },
            });
            // Fallback: tenta insert puro
            const { error: insErr } = await (supabase as any).from('providers').insert(providerPayload);
            if (insErr) throw insErr;
          }
          return true;
        },
      });
      if (!upsertResult.ok) return;

      await addSessionPointsToProfile();
      await refetchProfile?.();
      goto('celebration');
    } catch (err: any) {
      logWizardError({ phase: 'phase1_contact', userId: user?.id, error: err, variant: 'v1', context: { action: 'bet_finish_pro_outer' } });
      toast.error(err?.message || 'Erro ao salvar cadastro', {
        action: { label: 'Tentar novamente', onClick: () => { void finishPro(); } },
      });
    }
  }

  const ctaLabel = useMemo(
    () => state.intent === 'client' ? 'Entrar no app' : 'Cadastrar meu 1º serviço',
    [state.intent],
  );

  function handleCelebrationCta() {
    if (state.intent === 'client') {
      navigate(next, { replace: true });
      return;
    }
    appendWizardResetDebugLog({
      source: 'bet-celebration-cta',
      route: '/cadastro-inicial',
      nextRoute: '/cadastro-inicial',
      phase: state.phase,
      reason: 'provider-clicked-first-service',
      meta: {
        city: state.city,
        state: state.state,
        hasName: state.full_name.trim().length > 0,
        hasWhatsapp: state.whatsapp.replace(/\D/g, '').length >= 10,
        unified: true,
      },
    });
    if (onInternalHandoff) {
      // Handoff para o V2: o V2Shell tem seu próprio draft remoto/local.
      // Limpamos o draft do Bet para evitar reidratação fantasma se o usuário
      // voltar ao /cadastro-inicial mais tarde.
      clearBetDraft();
      if (user?.id) void clearRemoteBetDraft(user.id);
      onInternalHandoff(state);
    } else {
      // Fallback (não deve ocorrer no fluxo unificado): mantém o usuário na
      // mesma rota e força um reload — impede loop em rotas legadas.
      clearBetDraft();
      if (user?.id) void clearRemoteBetDraft(user.id);
      navigate('/cadastro-inicial', { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-amber-50/30 dark:to-amber-950/10">
      <PointsHud
        points={state.points}
        phaseLabel={PHASE_LABELS[state.phase]}
        progress={PHASE_PROGRESS[state.phase]}
      />
      {state.phase === 'identity' && (
        <PhaseIdentity state={state} patch={patch} next={() => goto('who')} addPoints={addPoints} />
      )}
      {state.phase === 'who' && (
        <PhaseWho state={state} patch={patch} goto={pickIntent} addPoints={addPoints} />
      )}
      {state.phase === 'client_city' && (
        <PhaseClientCity state={state} patch={patch} finish={finishClient} addPoints={addPoints} />
      )}
      {state.phase === 'pro_kind' && (
        <PhaseProKind state={state} patch={patch} next={afterProKind} addPoints={addPoints} />
      )}
      {/* pro_document removido da triagem — CPF/CNPJ é coletado em main_document, após o 1º serviço */}
      {state.phase === 'pro_location' && (
        <PhaseProLocation state={state} patch={patch} finish={finishPro} addPoints={addPoints} />
      )}
      {state.phase === 'celebration' && (
        <PhaseCelebration totalPoints={state.points} ctaLabel={ctaLabel} onCta={handleCelebrationCta} />
      )}
    </div>
  );
}
