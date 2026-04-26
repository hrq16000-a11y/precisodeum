/**
 * Bet Mode Shell — orquestra as fases do cadastro V3 "Bet Mode".
 *
 * Filosofia:
 *  - Isolado de V1 (/triagem) e V2 (/onboarding-v2) — NÃO os toca.
 *  - Salva direto em profiles (e providers para PJ/PF profissional).
 *  - Cliente: fast-pass, marca onboarding_completed=true e redireciona ao ?next=.
 *  - Profissional: completa identificação básica e empurra para /onboarding-v2
 *    para criar o 1º serviço (mantém ServiceWizard atômico — não duplica lógica).
 */
import { useEffect, useMemo, useReducer } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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

export default function BetModeShell() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const { user, profile, refetchProfile } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialBetState);

  useSeoHead({ title: 'Cadastro express', description: 'Cadastro rápido para começar agora.', noindex: true });

  // Pré-preenche com o que já existe (ex: nome do Google).
  useEffect(() => {
    if (!profile) return;
    dispatch({ type: 'PATCH', patch: {
      full_name: state.full_name || profile.full_name || '',
      whatsapp: state.whatsapp || (profile as any).whatsapp || '',
      city: state.city || profile.city || '',
      state: state.state || profile.state || '',
    }});
    // intencionalmente sem dep state.* para não loopar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const patch = (p: Partial<BetState>) => dispatch({ type: 'PATCH', patch: p });
  const goto = (phase: BetPhase) => dispatch({ type: 'GOTO', phase });
  const addPoints = (n: number) => dispatch({ type: 'POINTS', n });

  function pickIntent(intent: BetIntent) {
    patch({ intent });
    goto(intent === 'client' ? 'client_city' : 'pro_kind');
  }

  /** Cliente fast-pass: salva e libera o gate de onboarding. */
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
      // Pontos (best-effort, não bloqueia o fluxo).
      try {
        await (supabase as any)
          .from('profiles')
          .update({ engagement_points: (profile as any)?.engagement_points
            ? (profile as any).engagement_points + state.points
            : state.points })
          .eq('id', user.id);
      } catch { /* noop */ }
      await refetchProfile?.();
      goto('celebration');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar cadastro');
    }
  }

  /** Profissional: salva profile + provider mínimo, depois empurra para V2 (1º serviço). */
  async function finishPro() {
    if (!user) { toast.error('Faça login antes de continuar'); return; }
    try {
      const isPj = state.pro_kind === 'pj';
      const { error: pErr } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: state.full_name.trim(),
          whatsapp: state.whatsapp,
          city: state.city,
          state: state.state,
          profile_type: 'provider',
          onboarding_step: 3, // ainda falta serviço; V2 conclui
        })
        .eq('id', user.id);
      if (pErr) throw pErr;

      const providerPayload = normalizeProviderPayload({
        user_id: user.id,
        full_name: state.full_name.trim(),
        company_name: isPj ? state.company_name.trim() : null,
        kind: state.pro_kind,
        document: state.document,
        whatsapp: state.whatsapp,
        phone: state.whatsapp,
        city: state.city,
        state: state.state,
        description: '',
      });

      // Tenta upsert por user_id (ON CONFLICT). Se a tabela não tiver constraint,
      // cai para insert simples — qualquer erro é "best-effort" e o V2 termina depois.
      try {
        await (supabase as any).from('providers').upsert(providerPayload, { onConflict: 'user_id' });
      } catch {
        try { await (supabase as any).from('providers').insert(providerPayload); } catch { /* noop */ }
      }

      try {
        await (supabase as any)
          .from('profiles')
          .update({ engagement_points: (profile as any)?.engagement_points
            ? (profile as any).engagement_points + state.points
            : state.points })
          .eq('id', user.id);
      } catch { /* noop */ }

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
    } else {
      // V2 conduz a criação do 1º serviço
      navigate('/onboarding-v2', { replace: true });
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
        <PhaseProKind state={state} patch={patch} next={() => goto('pro_document')} addPoints={addPoints} />
      )}
      {state.phase === 'pro_document' && (
        <PhaseProDocument state={state} patch={patch} next={() => goto('pro_location')} addPoints={addPoints} />
      )}
      {state.phase === 'pro_location' && (
        <PhaseProLocation state={state} patch={patch} finish={finishPro} addPoints={addPoints} />
      )}
      {state.phase === 'celebration' && (
        <PhaseCelebration totalPoints={state.points} ctaLabel={ctaLabel} onCta={handleCelebrationCta} />
      )}
    </div>
  );
}
