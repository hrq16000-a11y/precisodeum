/**
 * Bet Mode Shell — orquestra as fases do cadastro V3 "Bet Mode".
 *
 * Filosofia:
 *  - Porta única do cadastro: V1 (/triagem) e o flag de A/B foram removidos.
 *  - Salva direto em profiles (e providers para PJ/PF profissional).
 *  - Cliente: fast-pass, marca onboarding_completed=true e redireciona ao ?next=.
 *  - Profissional: completa identificação básica e segue no fluxo único para
 *    criar o 1º serviço sem repetir nome, WhatsApp e cidade já capturados.
 */
import { useEffect, useMemo, useReducer } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';
import { normalizeProviderPayload } from '@/lib/providerPayload';
import { useSeoHead } from '@/hooks/useSeoHead';

import PointsHud from './PointsHud';
import PhaseIdentity from './PhaseIdentity';
import PhaseWho from './PhaseWho';
import PhaseClientCity from './PhaseClientCity';
import PhaseProKind from './PhaseProKind';
import PhaseProDocument from './PhaseProDocument';
import PhaseProLocation from './PhaseProLocation';
import PhaseCelebration from './PhaseCelebration';

import { initialBetState, type BetState, type BetIntent, type BetPhase } from './types';

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
  const [state, dispatch] = useReducer(reducer, initialBetState);

  useSeoHead({ title: 'Cadastro express', description: 'Cadastro rápido para começar agora.', noindex: true });

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

  const patch = (p: Partial<BetState>) => dispatch({ type: 'PATCH', patch: p });
  const goto = (phase: BetPhase) => dispatch({ type: 'GOTO', phase });
  const addPoints = (n: number) => dispatch({ type: 'POINTS', n });

  async function finishRh() {
    if (!user) { toast.error('Faça login antes de continuar'); return; }
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
      navigate('/dashboard/agencia', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar cadastro da agência');
    }
  }

  async function finishSponsor() {
    if (!user) { toast.error('Faça login antes de continuar'); return; }
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
      navigate('/quero-ser-patrocinador', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao iniciar fluxo de patrocinador');
    }
  }

  function pickIntent(intent: BetIntent) {
    patch({ intent });
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
          profile_type: 'client',
          onboarding_step: 5,
          onboarding_completed: true,
        })
        .eq('id', user.id);
      if (error) throw error;
      await addSessionPointsToProfile();
      await refetchProfile?.();
      toast.success(`+${state.points} pts conquistados!`, { description: 'Bem-vindo. Levando você ao destino…' });
      navigate(next, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar cadastro');
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

      // ---- providers: documento na coluna certa + business_name (PJ) + neighborhood ----
      const providerPayload = normalizeProviderPayload({
        user_id: user.id,
        account_type: isPj ? 'pj' : 'pf',
        business_name: isPj ? (state.company_name || '').trim() || null : null,
        legal_name: isPj ? (state.company_name || '').trim() || null : state.full_name.trim(),
        cpf,
        cnpj,
        whatsapp: state.whatsapp,
        phone: state.whatsapp,
        city: state.city,
        state: state.state,
        neighborhood: '', // NOT NULL — wizard não captura ainda; V2/Dashboard refina depois.
        description: '',
      });

      try {
        await (supabase as any).from('providers').upsert(providerPayload, { onConflict: 'user_id' });
      } catch {
        try { await (supabase as any).from('providers').insert(providerPayload); } catch { /* noop */ }
      }

      await addSessionPointsToProfile();
      await refetchProfile?.();
      goto('celebration');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar cadastro');
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
      onInternalHandoff(state);
    } else {
      // Fallback (não deve ocorrer no fluxo unificado): mantém o usuário na
      // mesma rota e força um reload — impede loop em rotas legadas.
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
