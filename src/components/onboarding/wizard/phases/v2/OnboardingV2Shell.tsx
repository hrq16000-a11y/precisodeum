/**
 * OnboardingV2Shell — ORQUESTRADOR INTERNO da FASE PRINCIPAL do wizard unificado.
 *
 * ⚠️ NÃO É UM WRAPPER. Contém:
 *  - Reducer próprio (`onboardingReducer`) com 13 sub-fases
 *  - Autosave local (localStorage) + remoto (`onboarding_v2_drafts`)
 *  - Persistência idempotente em providers/profiles via `normalizeProviderPayload`
 *  - Criação atômica do 1º serviço via RPC `create_service_atomic`
 *  - Hidratação a partir de `seedState` quando vem da triagem (handoff interno)
 *  - Detecção de duplicidade via `useWizardDuplicateCheck`
 *
 * É consumido EXCLUSIVAMENTE por `WizardShell` sob o alias `MainOrchestrator`.
 * Não exportar publicamente, não usar fora do WizardShell, não inlinar — manter
 * a separação preserva ~1000 linhas de lógica isoladas e testáveis.
 *
 * Telemetria mínima e segura: usa apenas o que já existe (audit_log via celebrate).
 *
 * Mantém compatibilidade total com o gate de onboarding (App.tsx):
 * grava `profiles.onboarding_step = 5` e `onboarding_completed = true`
 * ao concluir a Fase 2 — destravando o usuário para o dashboard.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';
import { normalizeProviderPayload } from '@/lib/providerPayload';
import { logWizardError } from '@/lib/wizardErrorGuard';
// E19 (back orchestrator) owns registerBackOwner/claimBackEvent — extraído.
import { markOnboardingCompletionGrace } from '@/lib/onboardingAccess';
import { finalizeOnboarding } from '@/lib/finalizeOnboarding';
import { setActiveWizardPhase, scheduleWizardTimeout } from '@/lib/wizardZombieGuard';
import { parseProviderIntegrityError, dispatchProviderIntegrityFocus } from '@/lib/providerIntegrityError';
import {
  warnIfForbiddenAddress,
  parseServiceAreaToCities,
  parseStartingPrice,
  buildProviderSocialPatch,
  withProviderLocationFallback,
  slugify,
} from '@/lib/onboarding/persistence/providerPatchHelpers';
import { useWizardDuplicateCheck } from '@/hooks/useWizardDuplicateCheck';
import {
  initialOnboardingState,
  onboardingReducer,
  VISIBLE_PHASES_COUNT,
} from './state';
// Phase1Action/Kind/Location/Contact REMOVIDOS na consolidação Bet Mode
// (mai/2026). Esses passos eram duplicações das telas da triagem (Bet Mode);
// agora a fase principal começa direto em phase2_service.
import { Phase2Service, Phase2Details } from './Phase2Service';
import { Phase2Photos } from './Phase2Photos';
import { Phase3Celebration } from './Phase3Celebration';
import { Phase4Document, Phase4Avatar, Phase4ExtrasA, Phase4ExtrasB } from './Phase4Final';
// Phase4Review removido — Wizard publica silenciosamente, sem tela de revisão.
import { PhaseRepairContact } from './PhaseRepairContact';
import { AutoSaveBadge } from './AutoSaveBadge';
import { nullifyEmpty } from './optionalPatch';
import { playWizardTransition } from '@/lib/wizardTransition';
import ReportWizardErrorButton from '@/components/wizard/ReportWizardErrorButton';
import {
  WIZARD_ERROR_CODES,
  phase2PhotosBlockCode,
  RECOVER_BACKOFF_DELAYS_MS,
  RECOVER_MAX_ATTEMPTS,
  recoverBackoffDelayMs,
} from '@/lib/wizardErrorCodes';
import { useWizardExitGuard } from '@/hooks/useWizardExitGuard';
import WizardEncouragement from '@/components/onboarding/wizard/WizardEncouragement';
import { useServicePhotoCount } from '@/hooks/useServicePhotoCount';
import { markPatchTouched, clearSessionTouched } from './sessionTouched';
import { pushReviewPhase, clearReviewHistory } from './reviewHistory';
import {
  useOnboardingV2Draft,
  readOnboardingV2Draft,
  clearOnboardingV2Draft,
} from './useOnboardingV2Draft';
import { flushLocalDraft } from './flushDraft';
import { findExistingFirstService, findExistingProvider, fetchExistingFirstService } from './findExistingRecords';
import {
  useOnboardingV2RemoteDraft,
  clearRemoteDraft,
} from './useOnboardingV2RemoteDraft';
import { getOnboardingContactValidation } from './contactValidation';
import {
  trackOnboardingEvent,
  markPhaseEnter,
  markPhaseExit,
  setOnboardingDraftSource,
  getOnboardingDraftSource,
  setOnboardingFlow,
} from './telemetry';
import { RemoteDraftRecoveryModal } from './RemoteDraftRecoveryModal';
import { validateDraftShape } from './draftEnvelope';
import { isTabLeader } from './crossTabSync';
import { useLeaderWriteGate } from '@/hooks/onboarding/useLeaderWriteGate';
import { useBackNavigationOrchestrator } from '@/hooks/onboarding/useBackNavigationOrchestrator';
import { usePhaseTransitionOrchestrator } from '@/hooks/onboarding/usePhaseTransitionOrchestrator';
import { usePersistenceRecoveryOrchestrator } from '@/hooks/onboarding/usePersistenceRecoveryOrchestrator';
import { useCrossTabRecoveryOrchestrator } from '@/hooks/onboarding/useCrossTabRecoveryOrchestrator';
import { useHydrationCoreOrchestrator } from '@/hooks/onboarding/useHydrationCoreOrchestrator';
import { useSubmitCoreOrchestrator } from '@/hooks/onboarding/useSubmitCoreOrchestrator';
import { useAbandonmentTimer } from './useAbandonmentTimer';
// getLastReadDraftDiagnostics consumido dentro de usePersistenceRecoveryOrchestrator (E8, PR 9).
import WizardErrorModal from '@/components/wizard/WizardErrorModal';
import {
  buildOnboardingCoreLocks,
  buildOnboardingV2BootstrapState,
  getPendingOnboardingCoreFields,
  resolveOnboardingV2SeedState,
} from './bootstrap';
import { buildWorkingHoursSummary } from './workingHours';
import BetCardShell from '@/components/onboarding/wizard/BetCardShell';
import { TERMS_VERSION, readVelocityMps, readAccuracyMeters } from '@/lib/wizardSnapshotInputs';
import { buildPersistFirstServiceOperation, logOperationBuildFailure } from '@/lib/operations';
// PR 9 — UI Composition Pass: extrações puramente visuais.
import { Phase2PhotosBlockedCard } from '@/components/onboarding/v2/phases/Phase2PhotosBlockedCard';
import { DraftRestoredBanner } from '@/components/onboarding/v2/phases/DraftRestoredBanner';
import { useOnboardingViewModel } from '@/hooks/onboarding/useOnboardingViewModel';



interface OnboardingV2ShellProps {
  /**
   * Marca verdade quando o V2 Shell é aberto logo após a triagem (V3) dentro
   * do WizardShell unificado. Substitui o antigo gatilho via query string,
   * que não existe mais agora que o handoff é interno (sem trocar de URL).
   */
  internalHandoffFromTriage?: boolean;
  /** Seed inicial vindo do WizardShell para evitar re-perguntar dados já capturados. */
  seedState?: Partial<import('./types').OnboardingState>;
  /**
   * Reporta a fase interna corrente para o WizardShell exibir a barra
   * de progresso global (Consolidação Fase 1).
   */
  onPhaseChange?: (phase: import('./types').OnboardingPhase) => void;
  /** Quando true, o shell V2 não navega sozinho para a tela de sucesso; devolve o controle ao wizard unificado. */
  deferCompletionToParent?: boolean;
  /**
   * Quando true (modo edit_profile/revisão), ignora o draft local e prioriza
   * o `seedState` vindo do banco. Evita que rascunhos antigos com campos
   * vazios (ex.: `description: ''`) sobrescrevam dados reais já publicados.
   */
  editMode?: boolean;
}

export const OnboardingV2Shell = ({ internalHandoffFromTriage = false, seedState, onPhaseChange, deferCompletionToParent = false, editMode = false }: OnboardingV2ShellProps = {}) => {
  const { user, profile, provider, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Em edit_profile, o usuário voltou para revisar — qualquer draft local
  // antigo (provavelmente com campos vazios) deve ser ignorado em favor dos
  // dados reais já no banco, propagados via `seedState`. Caso contrário, um
  // rascunho stale pode mascarar a descrição/nome do serviço já publicado.
  const skipDraftRestore =
    editMode ||
    (internalHandoffFromTriage && seedState?.phase === 'phase2_service');
  // Restaura draft local ao montar (se existir e não estiver expirado)
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState, (init) => {
    const draft = skipDraftRestore ? null : readOnboardingV2Draft();
    const seeded = {
      ...init,
      ...seedState,
      profile: { ...init.profile, ...(seedState?.profile || {}) },
      service: { ...init.service, ...(seedState?.service || {}) },
      userRef: seedState?.userRef ?? init.userRef,
      providerId: seedState?.providerId ?? init.providerId,
      firstServiceId: seedState?.firstServiceId ?? init.firstServiceId,
    };
    if (!draft) return seeded;
    // Merge do draft NÃO-DESTRUTIVO: campos vazios do draft nunca sobrescrevem
    // valores já presentes no seedState (banco). Antes era `{...seeded, ...draft}`,
    // o que apagava `service.description` quando o draft tinha string vazia.
    const mergeNonDestructive = <T extends Record<string, any>>(base: T, patch: Partial<T> | undefined): T => {
      if (!patch) return base;
      const out: any = { ...base };
      for (const k of Object.keys(patch)) {
        const v = (patch as any)[k];
        const isEmpty =
          v === null ||
          v === undefined ||
          (typeof v === 'string' && v.trim() === '') ||
          (Array.isArray(v) && v.length === 0);
        if (!isEmpty) out[k] = v;
      }
      return out as T;
    };
    return {
      ...seeded,
      profile: mergeNonDestructive(seeded.profile, draft.profile),
      service: mergeNonDestructive(seeded.service, draft.service),
      phase: draft.phase || seedState?.phase || seeded.phase,
      userRef: draft.userRef ?? seeded.userRef,
      providerId: draft.providerId ?? seeded.providerId,
      firstServiceId: draft.firstServiceId ?? seeded.firstServiceId,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PR 4C · ORDERING CONTRACT SCAFFOLDING (observational only)
  // ─────────────────────────────────────────────────────────────────────────
  // `stateRef` espelha o `state` do reducer para que extrações futuras possam
  // ler snapshot atômico sem stale closure. NÃO é lido por nenhum effect
  // ainda (mantém behavior idêntico ao PR 4B).
  //
  // `lifecyclePhaseRef` é um marcador observacional do lifecycle operacional
  // do shell. Atualizado por effects existentes nos pontos canônicos. Nenhum
  // effect GATEIA por ele nesta PR — é apenas observabilidade para preparar
  // futura promoção a contrato de ordem explícito.
  //
  // Lifecycle:
  //   BOOT       → mount inicial (antes de qualquer HYDRATE)
  //   HYDRATING  → bootstrap (E14) ou revisão DB (E15) em curso
  //   HYDRATED   → HYDRATE concluído (E14/E15)
  //   READY      → fase mudou após HYDRATED (E16 enter normal)
  //   SUBMITTING → state.phase === 'done' (E18 agendou finishWizard)
  //   COMPLETED  → finishWizard retornou com sucesso
  //
  // SANITY (PR 4D): `lifecyclePhaseRef` pode permanecer em 'HYDRATING' quando
  // E14 entra mas retorna cedo (bootstrap nulo, regressão de fase bloqueada
  // ou snapshot estruturalmente idêntico). É COMPORTAMENTO ESPERADO — nenhum
  // effect gateia por este ref. Promoção a gate funcional exigirá, no futuro,
  // ou transição explícita 'HYDRATING → BOOT' nos early returns, ou um
  // sentinel 'HYDRATING_NOOP' distinto. Ver docs/onboarding-effect-map.md
  // (seção PR 4D · sanity).
  //
  // ORDERING CONTRACTS (ver docs/onboarding-effect-map.md §PR 4C):
  //   Chain A (RECOV):  E9 → E12 → E13 → E8/E11 → E14 → E15 → E5
  //   Chain B (PHASE):  state.phase change → E17 → E16 → E5 → E6 → (E18 se 'done')
  //   Chain C (BACK):   wizard:request-back → E19 → flush → dispatch GO_TO → Chain B
  //   Chain D (CT):     E9 (init) → E10 (poll) → isTabLeader() gate em flush/persist
  //   Chain E (FLOW):   isCompany → E3 sticky → trackEvent → E4/E6/E16
  // ─────────────────────────────────────────────────────────────────────────
  const stateRef = useRef(state);
  stateRef.current = state; // sync write em cada render — sem useEffect (evita race com flush)
  const lifecyclePhaseRef = useRef<
    'BOOT' | 'HYDRATING' | 'HYDRATED' | 'READY' | 'SUBMITTING' | 'COMPLETED'
  >('BOOT');

  // PR 5 · OWNERSHIP HELPERS (preparação de extração — não muda behavior).
  //
  // `getCurrentState()` é o read-path canônico para callbacks assíncronos,
  // delayed handlers e timers que precisam do snapshot ATUAL do reducer (não
  // do snapshot capturado na closure). Effects síncronos continuam lendo
  // `state` direto — é mais expressivo. Async/delayed deve preferir este
  // helper para eliminar stale-closure risk em refactors futuros.
  const getCurrentState = useCallback(() => stateRef.current, []);
  // `signalLifecyclePhase(next)` centraliza TODA escrita em `lifecyclePhaseRef`.
  // Sem state machine, sem event bus — apenas um setter único com no-op para
  // transições idempotentes. Existir como helper permite, no futuro, adicionar
  // gates/audit/log num único ponto sem caçar atribuições espalhadas.
  const signalLifecyclePhase = useCallback(
    (next: 'BOOT' | 'HYDRATING' | 'HYDRATED' | 'READY' | 'SUBMITTING' | 'COMPLETED') => {
      if (lifecyclePhaseRef.current === next) return;
      lifecyclePhaseRef.current = next;
    },
    [],
  );





  // Guard de rota: enquanto estiver entre phase2_service / details / photos,
  // qualquer tentativa de cair em /dashboard é bloqueada e devolvida ao wizard.
  // Não interfere em fases ≥ phase3_celebration nem em editMode.
  useWizardExitGuard({
    phase: state.phase,
    enabled: !editMode,
    onBlocked: ({ from, attemptedPath }) => {
      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user?.id,
        meta: { reason: 'exit_guard_blocked', from, attemptedPath },
      });
      toast.message('Falta pouco!', {
        description: 'Conclua o 1º serviço para acessar o painel.',
      });
    },
  });

  // Listener global do botão "Pular esta etapa" exibido pelo WizardShell em
  // modo edit_profile. Avança a fase atual via NEXT — mesmo comportamento
  // dos botões "Pular" internos. Idempotente; cleanup garante zero zumbi.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSkip = () => { dispatch({ type: 'NEXT' } as any); };
    window.addEventListener('wizard:request-skip', handleSkip as EventListener);
    return () => window.removeEventListener('wizard:request-skip', handleSkip as EventListener);
  }, []);

  // Wrappers que registram quais campos o usuário tocou nesta sessão
  // (usado pelo Review para merge não-destrutivo).
  const patchProfile = (patch: Partial<typeof state.profile>) => {
    markPatchTouched('profile', patch);
    dispatch({ type: 'PATCH_PROFILE', patch });
  };
  const patchService = (patch: Partial<typeof state.service>) => {
    markPatchTouched('service', patch);
    dispatch({ type: 'PATCH_SERVICE', patch });
  };

  const [saving, setSaving] = useState(false);
  // Última falha real de persistPhase1 — usada para mostrar mensagem específica
  // (em vez do toast genérico que mascarava a causa real do bloqueio).
  const [lastPersistError, setLastPersistError] = useState<null | {
    message: string;
    code?: string | null;
    at: number;
  }>(null);
  // Modal de erro contextual (substitui tela em branco): mostra código,
  // campos faltantes e CTAs claros (Voltar / Tentar novamente / Reportar).
  const [errorModal, setErrorModal] = useState<null | {
    code: string;
    missingFields: string[];
    techMessage?: string | null;
    techCode?: string | null;
    onRetry?: () => void;
  }>(null);
  const [draftRestored, setDraftRestored] = useState<null | { source: 'local' | 'remote'; at?: string }>(null);
  // Timer do hint "rascunho restaurado". PR 5: lifecycle agora é OWNED por um
  // useEffect que reage a `draftRestored?.source === 'remote'`. A ref existe
  // apenas como handle de cleanup defensivo no unmount (mantida para zero risco
  // de zombie timer durante a transição).
  const remoteDraftHintTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (remoteDraftHintTimer.current) window.clearTimeout(remoteDraftHintTimer.current);
  }, []);
  // E-REMOTE-HINT · ORDER CONTRACT (PR 5 · timer internalizado)
  //   REQUIRES: handleRemoteContinue setou draftRestored.source='remote'.
  //   PRODUCES: setDraftRestored(null) após 6s.
  //   CONSUMERS: UI hint.
  //   OWNERSHIP: este effect é o ÚNICO owner do timer; cleanup garante zero zombie.
  //   STALE-CLOSURE: usa getCurrentState() para fase-at-schedule (não closure).
  useEffect(() => {
    if (draftRestored?.source !== 'remote') return;
    const phaseAtSchedule = getCurrentState().phase as any;
    const handle = scheduleWizardTimeout(
      { phase: phaseAtSchedule, action: 'shell_remote_draft_hint_clear' },
      () => setDraftRestored(null),
      6000,
    );
    remoteDraftHintTimer.current = handle;
    return () => {
      window.clearTimeout(handle);
      if (remoteDraftHintTimer.current === handle) remoteDraftHintTimer.current = null;
    };
  }, [draftRestored?.source, draftRestored?.at, getCurrentState]);

  const [remoteDraft, setRemoteDraft] = useState<null | {
    payload: { profile: any; service: any; userRef?: string | null; providerId?: string | null; firstServiceId?: string | null };
    phase: any;
    updated_at: string;
  }>(null);
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const coreLocks = useMemo(() => buildOnboardingCoreLocks({ profile, provider }), [profile, provider]);
  const pendingCoreFields = useMemo(() => getPendingOnboardingCoreFields(coreLocks), [coreLocks]);

  // Frente 4 — duplicidade inline (whatsapp + tax_id)
  const dup = useWizardDuplicateCheck();

  // ── ISOLAMENTO DE GATILHOS (refactor 2026) ────────────────────────────────
  // `isCompany` é a CONDIÇÃO MESTRE para diferenciar o fluxo PJ/Empresa do
  // fluxo padrão (PF). Toda telemetria emitida pelo V2Shell carrega
  // `meta.flow` automaticamente para que segmentações no admin não dependam
  // de inferência heurística posterior.
  const isCompany = useMemo(() => {
    const acc = ((profile as any)?.account_type || '').toString().toLowerCase();
    if (acc === 'company' || acc === 'pj') return true;
    return state.profile.kind === 'pj';
  }, [profile, state.profile.kind]);

  /** Wrapper único que injeta a dimensão `flow` em todo evento de telemetria. */
  const trackEvent = useCallback(
    (args: Parameters<typeof trackOnboardingEvent>[0]) =>
      trackOnboardingEvent({
        ...args,
        meta: { flow: isCompany ? 'company' : 'default', ...(args.meta || {}) },
      }),
    [isCompany],
  );

  // Reflete o flow atual num sticky de sessão para que callers externos
  // (BetModeShell, WizardShell, ExitIntentDialog, etc.) que ainda chamam
  // `trackOnboardingEvent` diretamente também recebam `meta.flow` automaticamente.
  useEffect(() => {
    setOnboardingFlow(isCompany ? 'company' : 'default');
  }, [isCompany]);

  // Auditoria de consistência: detectamos `isCompany` por DOIS sinais
  // (profile.account_type vindo do banco e state.profile.kind do reducer).
  // Quando divergem, registramos um evento dedicado para que o admin
  // (/admin/onboarding-stats) consiga identificar imediatamente PJs que
  // estão caindo no fluxo PF (e vice-versa) — sintoma clássico do bug em
  // que a triagem inicial setou um kind diferente do tipo de conta.
  const lastFlowMismatchRef = useRef<string | null>(null);
  useEffect(() => {
    const acc = ((profile as any)?.account_type || '').toString().toLowerCase();
    const accIsCompany = acc === 'company' || acc === 'pj';
    const kindIsCompany = state.profile.kind === 'pj';
    if (!acc) return; // ainda carregando profile — sem ruído
    if (accIsCompany === kindIsCompany) return; // consistente
    const fingerprint = `${acc}|${state.profile.kind || 'null'}|${state.phase}`;
    if (lastFlowMismatchRef.current === fingerprint) return; // dedup por sessão
    lastFlowMismatchRef.current = fingerprint;
    void trackOnboardingEvent({
      phase: state.phase,
      event: 'error',
      userId: user?.id,
      meta: {
        flow: isCompany ? 'company' : 'default',
        kind: 'flow_mismatch',
        account_type: acc,
        profile_kind: state.profile.kind || null,
        resolved_as: isCompany ? 'company' : 'default',
      },
    });
  }, [profile, state.profile.kind, state.phase, user?.id, isCompany]);


  // Auto-save em localStorage com debounce (rápido).
  // Em edit_profile/revisão, NÃO persistimos draft local — o usuário está
  // revisando dados já publicados e o draft seria poluição que poderia
  // mascarar campos reais em retornos futuros (sintoma "Assistente apagou tudo").
  useOnboardingV2Draft(state, !editMode);
  // Auto-save remoto com debounce (cross-device).
  // BLINDAGEM (auditoria 2026-05): em editMode NÃO escrevemos draft remoto —
  // a fonte de verdade é o banco. Passamos userId=undefined para o hook
  // entrar em modo no-op (early return interno em !userId).
  useOnboardingV2RemoteDraft(state, editMode ? undefined : user?.id);

  // E5 · Phase Transition Orchestrator (Chain B step 3) — extraído em PR 7.
  // Contract completo vive em `usePhaseTransitionOrchestrator`. POSITION-
  // DEPENDENCY preservada: chamado APÓS E17 (acima) e ANTES de E18 (abaixo).
  usePhaseTransitionOrchestrator({
    getCurrentState,
    phase: state.phase,
    userId: user?.id,
    editMode,
  });




  // ── Sentinela anti-amnésia em fases finais (auditoria 2026-05) ─────────
  // Em fases finais (extras_b/avatar/document/extras_a) city/state DEVEM já
  // estar preenchidos (vêm da triagem Bet). Se não estiverem, é regressão
  // de estado: avisamos visualmente e logamos para diagnóstico. O fallback
  // em `withProviderLocationFallback` cobre o write, mas o usuário precisa
  // saber para revisar a etapa de localização.
  const locationWarningShownRef = useRef(false);
  useEffect(() => {
    const finalPhases = ['phase4_document', 'phase4_avatar', 'phase4_extras_a', 'phase4_extras_b'];
    if (!finalPhases.includes(state.phase)) {
      locationWarningShownRef.current = false;
      return;
    }
    const missing: string[] = [];
    if (!(state.profile.city || '').trim()) missing.push('cidade');
    if (!(state.profile.state || '').trim()) missing.push('estado');
    if (missing.length === 0 || locationWarningShownRef.current) return;
    locationWarningShownRef.current = true;
    void trackEvent({
      phase: state.phase,
      event: 'error',
      userId: user?.id,
      meta: { reason: 'missing_location_in_final_phase', missing },
    });
    toast.warning('Falta a sua localização', {
      description: `Sem ${missing.join(' e ')}, seu perfil não aparece nas buscas. Volte à etapa "Localização" para preencher.`,
      duration: 8000,
    });
  }, [state.phase, state.profile.city, state.profile.state, user?.id, trackEvent]);


  // Flush ao desmontar / antes de fechar a aba
  useEffect(() => {
    const onBeforeUnload = () => {
      try { flushLocalDraft(state); } catch { /* noop */ }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state]);

  // E8 · Persistence / Recovery Orchestrator (Chain A · RECOV) — extraído em PR 9.
  // Contract completo vive em `usePersistenceRecoveryOrchestrator`. POSITION-
  // DEPENDENCY preservada: chamado ANTES de E14 (bootstrap HYDRATE) para que
  // o sticky draft source (seed/local/none) esteja definido quando E14 rodar.
  // `setDraftRestored` permanece ownership do shell (consumido pelo banner UI).
  usePersistenceRecoveryOrchestrator({
    getCurrentState,
    skipDraftRestore,
    userId: user?.id,
    setDraftRestored,
  });

  // E11 · Leader / Write Gating Orchestrator (Chain D) — extraído em PR 8.
  // Contract completo vive em `useLeaderWriteGate`. Hook é o único owner
  // de heartbeat + leader election no shell V2. Nenhum consumer local de
  // `isLeader` — CadastroInicialPage mantém seu próprio polling para o
  // banner de aba secundária.
  useLeaderWriteGate({
    getCurrentState,
    userId: user?.id,
  });




  // Hardening F4: detector de abandono silencioso (15min sem interação).
  // Desabilitado se onboarding já concluído — evita ruído pós-finalize.
  useAbandonmentTimer(
    state.phase as any,
    user?.id,
    Boolean((profile as any)?.onboarding_completed) || state.phase === 'done',
  );


  // E9 · Cross-Tab Recovery Orchestrator — extraído em PR 7 (final).
  // Contract completo vive em `useCrossTabRecoveryOrchestrator`. Hook é o
  // ÚNICO owner do bootstrap de detecção remote-draft + neutralização de
  // zumbis da triagem. Handlers do modal (`handleRemoteContinue` /
  // `handleRemoteDiscard`) permanecem aqui — únicos caminhos legítimos
  // para dispatch HYDRATE / clearRemoteDraft após decisão do usuário.
  useCrossTabRecoveryOrchestrator({
    userId: user?.id,
    skipDraftRestore,
    currentPhase: state.phase,
    setRemoteDraft,
    setShowRemoteModal,
  });


  const handleRemoteContinue = () => {
    if (remoteDraft) {
      // Hardening F6: valida shape antes de hidratar — descarta payload corrompido.
      const shape = validateDraftShape({
        profile: remoteDraft.payload?.profile,
        service: remoteDraft.payload?.service,
        phase: remoteDraft.phase,
      });
      if (!shape.ok) {
        void trackOnboardingEvent({
          phase: state.phase,
          event: 'error',
          userId: user?.id,
          meta: { kind: 'recovery_remote_discarded', reason: `shape_${shape.reason}` },
        });
        setShowRemoteModal(false);
        setRemoteDraft(null);
        return;
      }
      dispatch({
        type: 'HYDRATE',
        state: {
          profile: remoteDraft.payload.profile,
          service: remoteDraft.payload.service,
          userRef: remoteDraft.payload.userRef ?? null,
          providerId: remoteDraft.payload.providerId ?? null,
          firstServiceId: remoteDraft.payload.firstServiceId ?? null,
          phase: remoteDraft.phase as any,
        },
      });
      void trackOnboardingEvent({
        phase: remoteDraft.phase as any,
        event: 'next',
        userId: user?.id,
        meta: { kind: 'recovery_remote_used' },
      });
      setDraftRestored({ source: 'remote', at: remoteDraft.updated_at });
      setOnboardingDraftSource('remote');
      // PR 5: timer de "esconder hint" agora é OWNED pelo effect abaixo
      // (busca `draftRestored?.source === 'remote'`). Aqui apenas setamos o
      // state — o lifecycle do timer pertence ao effect, com cleanup garantido.
    }
    setShowRemoteModal(false);
    setRemoteDraft(null);
  };

  const handleRemoteDiscard = async () => {
    if (user?.id) await clearRemoteDraft(user.id);
    clearOnboardingV2Draft();
    setOnboardingDraftSource('none');
    toast.success('Rascunho descartado. Vamos começar do zero.');
    setShowRemoteModal(false);
    setRemoteDraft(null);
  };


  // Hidrata nome do auth se vier do Google
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata || {}) as any;
    const guessedName = meta.full_name || meta.name || '';
    if (guessedName && !state.profile.full_name) {
      dispatch({ type: 'PATCH_PROFILE', patch: { full_name: guessedName } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const nextUserRef = profile?.user_ref || null;
    if (nextUserRef && nextUserRef !== state.userRef) {
      dispatch({ type: 'SET_USER_REF', userRef: nextUserRef });
    }
  }, [profile?.user_ref, state.userRef]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HYDRATION CORE (E14 + E15) — EXTRAÍDO PARA useHydrationCoreOrchestrator
  // ───────────────────────────────────────────────────────────────────────────
  // Núcleo único coordenado (bootstrap + replay). Mantido acoplado por
  // contrato — não separar. Ver hook para HYDRATION-SEQUENCE, REPLAY
  // ISOLATION, OWNERSHIP, LIFECYCLE e RACE COM E5.
  //
  // Owners externalizados ao shell:
  //   - bootstrap seed (E14)                 → hook
  //   - replay/review (E15)                  → hook
  //   - hydration sequencing                 → hook (via lifecyclePhaseRef passado)
  //   - hydration lifecycle (HYDRATING/HYDRATED) → hook (via signalLifecyclePhase)
  //
  // Owners preservados no shell:
  //   - reducer, submit (E18), persistence (E5/E11), leader election.
  useHydrationCoreOrchestrator({
    profile,
    provider,
    internalHandoffFromTriage,
    user,
    state,
    dispatch,
    signalLifecyclePhase,
    lifecyclePhaseRef,
    pendingCoreFields,
    locationPath: location.pathname,
    locationSearch: location.search,
  });



  // Telemetria: dispara 'enter' a cada troca de fase + mede tempo na fase anterior.
  // - Cada fase recebe `markPhaseEnter` no mount/troca.
  // - Ao trocar de fase (cleanup), `markPhaseExit` emite o evento `phase_exit`
  //   com `duration_ms` e `draft_source` (local/remote/seed/none).
  // - O evento `enter` também carrega `draft_source` para segmentação.
  // E16 · ORDER CONTRACT (Chain B step 2 · phase telemetry)
  //   REQUIRES: E17 já chamado setActiveWizardPhase nesta fase.
  //   PRODUCES: 'enter'/'complete' event + markPhaseEnter; cleanup → markPhaseExit.
  useEffect(() => {

    const draftSource = getOnboardingDraftSource() || 'none';
    void trackEvent({
      phase: state.phase,
      event: state.phase === 'done' ? 'complete' : 'enter',
      userId: user?.id,
      meta: { draft_source: draftSource },
    });
    markPhaseEnter(state.phase);
    const exitingPhase = state.phase;
    return () => {
      // Emite duração da fase que está sendo deixada.
      void markPhaseExit(exitingPhase, { userId: user?.id });
    };
  }, [state.phase, user?.id]);

  // Reporta a fase para a barra de progresso global do WizardShell.
  // E17 · ORDER CONTRACT (Chain B step 1 · phase change head)
  //   PRODUCES: setActiveWizardPhase (zombie-timer gate global).
  //   CONSUMERS: TODOS os effects que agendam timers (E18, hint timers, etc.).
  //   POSITION-DEPENDENCY CRÍTICA: deve declarar-se ANTES de E16/E5/E18 para
  //              que setActiveWizardPhase rode primeiro no commit do React.
  //              Mover este bloco quebra atribuição de timers à fase correta.
  //   Atualiza lifecyclePhaseRef para 'READY' quando já hidratado.
  useEffect(() => {
    if (lifecyclePhaseRef.current === 'HYDRATED') signalLifecyclePhase('READY');

    onPhaseChange?.(state.phase);
    // Instrumentação: registra a fase ativa para o detector de timer zumbi.
    setActiveWizardPhase(state.phase);
    // Histórico de revisão: empilha cada fase visitada para que o botão
    // "Voltar" sempre devolva o usuário à fase REAL anterior nesta sessão
    // (em vez de seguir um mapa estático que não conhece os pulos via
    // EditModeSkipButton ou navegação direta por `?section=`).
    if (editMode) pushReviewPhase(state.phase);
  }, [state.phase, onPhaseChange, editMode]);

  // Antes: auto-NEXT silencioso quando faltava firstServiceId/user — isso
  // levava à tela em branco e mensagem genérica de "algo está errado". Agora
  // o card abaixo (case 'phase2_photos') exibe diagnóstico específico com
  // botões de recuperação. NÃO pulamos automaticamente.

  // E18 · Submit Core Orchestrator (Chain B step 5) — extraído em PR 13.
  // Contract completo (SUBMIT-SEQUENCE, CLEANUP-SEQUENCE, RETRY semantics,
  // FINALIZE-BOUNDARY, ASYNC BOUNDARIES, R1–R9 races) vive em
  // `useSubmitCoreOrchestrator`. `finalize_onboarding_atomic` continua
  // sendo a ÚNICA autoridade transacional terminal; este hook é o ÚNICO
  // trigger automático de submit (persistFirstService é write-core
  // separado, não submit terminal).

  useSubmitCoreOrchestrator({
    phase: state.phase,
    deferCompletionToParent,
    signalLifecyclePhase,
    finishWizard: () => finishWizard(),
  });


  // E19 · Back Navigation Orchestrator (Chain C) — extraído em PR 6.
  // Contract completo vive em `useBackNavigationOrchestrator`. Listener
  // registra UMA vez por (editMode, userId) — não rebinda em mudança de
  // `state` (read via getCurrentState/stateRef). dispatch é estável.
  useBackNavigationOrchestrator({
    getCurrentState,
    editMode,
    userId: user?.id,
    dispatch,
  });


  // Limpeza do histórico de revisão ao SAIR do modo edit_profile (ex.: usuário
  // volta para new_signup na mesma aba). Garante que pilha velha não vaze
  // para uma próxima sessão de revisão.
  useEffect(() => {
    if (!editMode) clearReviewHistory();
  }, [editMode]);

  /* ───── Persistência: cria/atualiza provider ao fim da Fase 1 ───── */
  const persistPhase1 = async () => {
    if (!isTabLeader()) {
      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user?.id,
        meta: { kind: 'write_blocked_non_leader', where: 'persistPhase1' } as any,
      });
      return false;
    }
    if (!user) {
      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user?.id,
        meta: { code: WIZARD_ERROR_CODES.PERSIST_PHASE1_NO_USER },
      });
      toast.error('Sessão expirou. Faça login novamente.');
      return false;
    }
    setSaving(true);
    setLastPersistError(null);
    try {
      const currentProfile = state.profile;
      let p = currentProfile;
      const needsHydration =
        !(currentProfile.full_name || '').trim() ||
        !(currentProfile.whatsapp || '').trim() ||
        !(currentProfile.city || '').trim() ||
        !(currentProfile.state || '').trim();

      if (needsHydration) {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, whatsapp, city, state, neighborhood, profile_type, user_ref, avatar_url')
            .eq('id', user.id)
            .maybeSingle();
          if (prof) {
            const merged = {
              ...currentProfile,
              full_name: (currentProfile.full_name || '').trim() ? currentProfile.full_name : (prof.full_name || currentProfile.full_name),
              whatsapp: (currentProfile.whatsapp || '').trim() ? currentProfile.whatsapp : (prof.whatsapp || currentProfile.whatsapp),
              city: (currentProfile.city || '').trim() ? currentProfile.city : (prof.city || currentProfile.city),
              state: (currentProfile.state || '').trim() ? currentProfile.state : (prof.state || currentProfile.state),
              neighborhood: (currentProfile.neighborhood || '').trim() ? currentProfile.neighborhood : (prof.neighborhood || currentProfile.neighborhood),
              profile_type: (currentProfile.profile_type || (prof.profile_type as typeof currentProfile.profile_type) || 'provider') as typeof currentProfile.profile_type,
              avatar_url: currentProfile.avatar_url || prof.avatar_url || currentProfile.avatar_url,
            };
            p = merged;
            const patch: Partial<typeof currentProfile> = {};
            if (merged.full_name !== currentProfile.full_name) patch.full_name = merged.full_name;
            if (merged.whatsapp !== currentProfile.whatsapp) patch.whatsapp = merged.whatsapp;
            if (merged.city !== currentProfile.city) patch.city = merged.city;
            if (merged.state !== currentProfile.state) patch.state = merged.state;
            if (merged.neighborhood !== currentProfile.neighborhood) patch.neighborhood = merged.neighborhood;
            if (merged.profile_type !== currentProfile.profile_type) patch.profile_type = merged.profile_type as any;
            if (merged.avatar_url !== currentProfile.avatar_url) patch.avatar_url = merged.avatar_url as any;
            if (Object.keys(patch).length > 0) {
              dispatch({ type: 'PATCH_PROFILE', patch });
            }
            if (prof.user_ref && !state.userRef) dispatch({ type: 'SET_USER_REF', userRef: prof.user_ref });
            void trackEvent({
              phase: state.phase,
              event: 'next',
              userId: user?.id,
              meta: {
                code: WIZARD_ERROR_CODES.ENSURE_PROVIDER_ID_HYDRATED_PROFILE,
                hydrated_fields: Object.keys(patch),
              },
            });
          }
        } catch {
          // best-effort
        }
      }

      const contactValidation = getOnboardingContactValidation({
        fullName: p.full_name,
        whatsapp: p.whatsapp,
      });

      if (!contactValidation.fullName) {
        void trackEvent({
          phase: state.phase,
          event: 'error',
          userId: user?.id,
          meta: {
            code: WIZARD_ERROR_CODES.PERSIST_PHASE1_MISSING_FIELDS,
            missing_fields: ['full_name'],
          },
        });
        toast.error('Informe nome e sobrenome para continuar.');
        return false;
      }

      if (!contactValidation.whatsapp) {
        void trackEvent({
          phase: state.phase,
          event: 'error',
          userId: user?.id,
          meta: {
            code: WIZARD_ERROR_CODES.PERSIST_PHASE1_MISSING_FIELDS,
            missing_fields: ['whatsapp'],
          },
        });
        toast.error('Informe um WhatsApp válido com DDD para continuar.');
        return false;
      }

      // 1) profile (nome, avatar, profile_type, whatsapp)
      const profilePatch: any = {
        full_name: p.full_name,
        whatsapp: p.whatsapp,
        phone: p.whatsapp,
        avatar_url: p.avatar_url,
        profile_type: p.profile_type || 'provider',
        onboarding_step: 4,
        onboarding_completed: false,
      };
      const { error: profErr } = await supabase
        .from('profiles')
        .update(profilePatch)
        .eq('id', user.id);
      if (profErr) throw profErr;

      // 2) provider apenas se for prestador
      if ((p.profile_type || 'provider') === 'provider') {
        // Resolve lat/lng com fallback de geocoding (Nominatim → IBGE) caso o
        // GPS não tenha sido disparado. Sem coords a coluna `geog` (PostGIS) fica
        // null e a busca por proximidade quebra silenciosamente.
        let lat: number | null =
          typeof (p as any).latitude === 'number' && Number.isFinite((p as any).latitude)
            ? (p as any).latitude
            : null;
        let lng: number | null =
          typeof (p as any).longitude === 'number' && Number.isFinite((p as any).longitude)
            ? (p as any).longitude
            : null;
        if ((lat === null || lng === null) && p.city && p.state) {
          try {
            const { geocodeAddress } = await import('@/lib/geocodeAddress');
            const g = await geocodeAddress({
              neighborhood: p.neighborhood || null,
              city: p.city,
              state: p.state,
            });
            if (typeof g.latitude === 'number' && Number.isFinite(g.latitude)) lat = g.latitude;
            if (typeof g.longitude === 'number' && Number.isFinite(g.longitude)) lng = g.longitude;
          } catch {
            // Geocoding é best-effort; não bloqueia o cadastro.
          }
        }

        // ANTI-DUPLICAÇÃO: query ignora qualquer ID local e busca direto no DB
        // por user_id. Se já existir, atualiza; senão, insere uma única vez.
        const { data: existing } = await supabase
          .from('providers').select('*').eq('user_id', user.id).is('deleted_at', null).limit(1);

        if (existing && existing[0]) {
          const fullName = (p.full_name || '').trim();
          // Front-end sync: garante business_name preenchido sem depender só do trigger DB.
          const businessName = (existing[0].business_name && String(existing[0].business_name).trim()) || fullName;
          const legalName = (existing[0].legal_name && String(existing[0].legal_name).trim()) || fullName;
          const updPayload = normalizeProviderPayload({
            city: p.city || existing[0].city || '',
            state: p.state || existing[0].state || '',
            whatsapp: p.whatsapp || existing[0].whatsapp || '',
            phone: p.whatsapp || existing[0].phone || '',
            account_type: p.kind === 'pj' ? 'company' : 'autonomous',
            business_name: businessName || null,
            legal_name: legalName || null,
            // Coordenadas — alimentam a coluna geog (PostGIS) via trigger.
            // Só envia quando temos par válido para evitar sobrescrever com null.
            ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
          });
          const { error } = await supabase.from('providers').update(updPayload as any).eq('id', existing[0].id);
          if (error) throw error;
          dispatch({ type: 'SET_PROVIDER_ID', id: existing[0].id });
        } else {
          // Double-check via helper (cobre raça entre tabs concorrentes)
          const reusedId = await findExistingProvider(user.id);
          if (reusedId) {
            dispatch({ type: 'SET_PROVIDER_ID', id: reusedId });
          } else {
            const fullName = (p.full_name || user.email?.split('@')[0] || 'profissional').trim();
            const baseSlug = slugify(fullName);
            const insPayload = normalizeProviderPayload({
              user_id: user.id,
              slug: `${baseSlug}-${user.id.slice(0, 6)}`,
              city: p.city || '',
              state: p.state || '',
              whatsapp: p.whatsapp || '',
              phone: p.whatsapp || '',
              account_type: p.kind === 'pj' ? 'company' : 'autonomous',
              // Front-end sync: business_name e legal_name preenchidos imediatamente.
              business_name: fullName,
              legal_name: fullName,
              status: 'pending',
              ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
            });
            const { data: created, error } = await supabase.from('providers').insert(insPayload as any).select('id').single();
            if (error) throw error;
            dispatch({ type: 'SET_PROVIDER_ID', id: created!.id });
          }
        }
      }
      return true;
    } catch (e: any) {
      console.error('[onboardingV2] persistPhase1 failed', {
        message: e?.message || String(e),
        code: e?.code || null,
        details: e?.details || null,
        hint: e?.hint || null,
        phase: state.phase,
        profileSnapshot: {
          full_name: state.profile.full_name,
          whatsapp_digits: state.profile.whatsapp?.replace(/\D/g, '').length || 0,
          city: state.profile.city,
          state: state.profile.state,
          has_latitude: typeof state.profile.latitude === 'number',
          has_longitude: typeof state.profile.longitude === 'number',
        },
      });
      const code = /fetch|network|timeout|offline|failed to fetch/i.test(String(e?.message || ''))
        ? WIZARD_ERROR_CODES.PERSIST_PHASE1_NETWORK
        : WIZARD_ERROR_CODES.PERSIST_PHASE1_DB_ERROR;
      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user?.id,
        meta: {
          code,
          error_code: e?.code || null,
          error_message: String(e?.message || 'Falha desconhecida ao salvar').slice(0, 300),
        },
      });
      logWizardError({
        phase: state.phase,
        userId: user?.id,
        error: e,
        variant: 'v2',
        context: { action: 'persist_phase1', code, has_provider_id: !!state.providerId, flow: isCompany ? 'company' : 'default' },
      });
      const errMsg = (e?.message || 'Falha desconhecida ao salvar').toString();
      const errCode = e?.code ? String(e.code) : null;
      setLastPersistError({ message: errMsg, code: errCode, at: Date.now() });
      toast.error('Não consegui salvar agora', {
        description: errMsg.slice(0, 200) + (errCode ? ` [cod: ${errCode}]` : ''),
        action: { label: 'Tentar novamente', onClick: () => { void persistPhase1(); } },
        duration: 10000,
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * ensureProviderId — resolve o provider_id de forma resiliente.
   *
   * Camadas (em ordem) — qualquer uma que devolver id curto-circuita o resto:
   *   1. state.providerId já em memória.
   *   2. Lookup direto em providers por user_id (cobre triggers/abas paralelas).
   *   3. Hidratação de identidade a partir de `profiles` quando state.profile
   *      vier vazio (caso comum: Bet Mode preencheu o profile mas não hidratou
   *      o reducer V2 antes de cair na Phase2Details).
   *   4. persistPhase1 (cria/atualiza profile + provider).
   *   5. Re-lookup com backoff exponencial (cobre race do trigger DB que
   *      materializa o provider depois do insert do profile).
   */
  const ensureProviderId = async (): Promise<string | null> => {
    if (!user) return null;
    if (state.providerId) return state.providerId;

    // 2) lookup direto antes de qualquer escrita
    try {
      const reusedId = await findExistingProvider(user.id, state.userRef ?? null);
      if (reusedId) {
        dispatch({ type: 'SET_PROVIDER_ID', id: reusedId });
        return reusedId;
      }
    } catch {
      /* noop */
    }

    // 3) hidrata profile a partir do DB se faltar identidade local
    //    (evita persistPhase1 falhar por full_name/city ausentes em memória).
    try {
      const p = state.profile;
      const needsHydration =
        !(p.full_name || '').trim() ||
        !(p.whatsapp || '').trim() ||
        !(p.city || '').trim() ||
        !(p.state || '').trim();
      if (needsHydration) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, whatsapp, city, state, neighborhood, profile_type, user_ref')
          .eq('id', user.id)
          .maybeSingle();
        if (prof) {
          const patch: Partial<typeof p> = {};
          if (!(p.full_name || '').trim() && prof.full_name) patch.full_name = prof.full_name;
          if (!(p.whatsapp || '').trim() && prof.whatsapp) patch.whatsapp = prof.whatsapp;
          if (!(p.city || '').trim() && prof.city) patch.city = prof.city;
          if (!(p.state || '').trim() && prof.state) patch.state = prof.state;
          if (!(p.neighborhood || '').trim() && prof.neighborhood) patch.neighborhood = prof.neighborhood;
          if (Object.keys(patch).length > 0) dispatch({ type: 'PATCH_PROFILE', patch });
          if (prof.user_ref && !state.userRef) dispatch({ type: 'SET_USER_REF', userRef: prof.user_ref });
        }
      }
    } catch { /* hidratação é best-effort */ }

    // 4) cria/atualiza
    const created = await persistPhase1();

    // 5) backoff canônico com jitter cobrindo race com triggers/concorrência
    for (let i = 0; i < RECOVER_MAX_ATTEMPTS; i++) {
      const delay = recoverBackoffDelayMs(i);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const recoveredId = await findExistingProvider(user.id, state.userRef ?? null);
        if (recoveredId) {
          dispatch({ type: 'SET_PROVIDER_ID', id: recoveredId });
          return recoveredId;
        }
      } catch { /* tenta de novo */ }
      if (!created && i === 0) break; // sem persist e sem registro: não adianta esperar
    }

    return null;
  };

  /* ───── Persistência ANTECIPADA do 1º serviço (Containment Crítico #2) ─────
   * Cria APENAS o registro mínimo em `services` ao sair de phase2_service —
   * sem chamar finalizeOnboarding, sem mexer em providers.category_id, sem
   * mostrar feedback. Objetivo: garantir que F5 entre phase2_service e
   * phase3_celebration NÃO perca o serviço já escolhido.
   *
   * 100% idempotente:
   *  - Se state.firstServiceId já existe → no-op.
   *  - Se já há um serviço dessa categoria p/ esse provider → reusa o id.
   *  - Caso contrário → INSERT mínimo (provider_id + service_name + category_id
   *    + campos defensivos com fallback null para satisfazer schema).
   *
   * Falha silenciosa (best-effort): NUNCA bloqueia o avanço do usuário — o
   * persistFirstService completo (phase2_details) cobre os campos restantes
   * e refaz a verificação de duplicidade.
   */
  const persistFirstServiceEarly = async (): Promise<boolean> => {
    if (!isTabLeader()) {
      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user?.id,
        meta: { kind: 'write_blocked_non_leader', where: 'persistFirstServiceEarly' } as any,
      });
      return false;
    }
    if (!user) return false;
    if (state.firstServiceId) return true;
    const categoryId = state.service.category_ids?.[0];
    const serviceName = (state.service.service_name || '').trim();
    if (!categoryId || !serviceName) return false;

    const providerId = await ensureProviderId();
    if (!providerId) return false;

    try {
      const reusedId = await findExistingFirstService(providerId, categoryId, serviceName);
      if (reusedId) {
        dispatch({ type: 'SET_FIRST_SERVICE_ID', id: reusedId });
        void trackEvent({
          phase: state.phase,
          event: 'submit',
          userId: user.id,
          meta: { kind: 'persist_first_service_early_reused', service_id: reusedId },
        });
        return true;
      }

      const cityAddress = [state.profile.city, state.profile.state].filter(Boolean).join(' - ');
      const { data: insertRow, error: insertErr } = await supabase
        .from('services')
        .insert({
          provider_id: providerId,
          service_name: serviceName,
          description: (state.service.description || '').trim(),
          whatsapp: state.profile.whatsapp || null,
          service_area: state.service.cities_served?.join('; ') || null,
          address: cityAddress || null,
          working_hours: state.service.working_hours || null,
          category_id: categoryId,
          category_ids: [categoryId],
        } as any)
        .select('id')
        .single();

      if (insertErr || !insertRow?.id) {
        void trackEvent({
          phase: state.phase,
          event: 'error',
          userId: user.id,
          meta: {
            kind: 'persist_first_service_early_failed',
            error_code: (insertErr as any)?.code || null,
            error_message: insertErr?.message?.slice(0, 240) || null,
          },
        });
        return false;
      }

      dispatch({ type: 'SET_FIRST_SERVICE_ID', id: insertRow.id });
      void trackEvent({
        phase: state.phase,
        event: 'submit',
        userId: user.id,
        meta: { kind: 'persist_first_service_early_ok', service_id: insertRow.id },
      });
      return true;
    } catch (e: any) {
      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user.id,
        meta: {
          kind: 'persist_first_service_early_throw',
          error_message: String(e?.message || e).slice(0, 240),
        },
      });
      return false;
    }
  };

  /* ───── Persistência: cria 1º serviço (Fase 2) ───── */
  const persistFirstService = async (): Promise<boolean> => {
    if (!isTabLeader()) {
      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user?.id,
        meta: { kind: 'write_blocked_non_leader', where: 'persistFirstService' } as any,
      });
      return false;
    }
    if (!user) return false;
    let workingProviderId = await ensureProviderId();

    // BLINDAGEM no_provider — se ensureProviderId falhou, fazemos UMA última
    // tentativa lendo o perfil DIRETO do DB (snapshot fresco, sem depender de
    // state.profile que pode estar desatualizado no mesmo ciclo de render) e
    // re-lookup do provider. Só após esse fallback declaramos falha terminal.
    let freshProfile: any = null;
    if (!workingProviderId) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, whatsapp, city, state, neighborhood, profile_type, user_ref')
          .eq('id', user.id)
          .maybeSingle();
        if (prof) {
          freshProfile = prof;
          // Sincroniza o reducer (não bloqueante para esta execução).
          dispatch({ type: 'PATCH_PROFILE', patch: prof as any });
        }
        // re-lookup final do provider (cobre trigger materializando após persist).
        const recoveredId = await findExistingProvider(user.id, state.userRef ?? freshProfile?.user_ref ?? null);
        if (recoveredId) {
          dispatch({ type: 'SET_PROVIDER_ID', id: recoveredId });
          workingProviderId = recoveredId;
          void trackEvent({
            phase: state.phase,
            event: 'next',
            userId: user?.id,
            meta: { code: WIZARD_ERROR_CODES.ENSURE_PROVIDER_ID_HYDRATED_PROFILE, recovered: true },
          });
        }
      } catch { /* fallback é best-effort */ }
    }

    if (!workingProviderId) {
      // Diagnóstico cirúrgico usando o SNAPSHOT MAIS FRESCO disponível
      // (freshProfile do DB > state.profile em memória).
      const p = freshProfile ?? state.profile;
      const missing: string[] = [];
      if (!(p.full_name || '').trim()) missing.push('nome completo');
      if (((p.whatsapp || '').replace(/\D/g, '').length) < 10) missing.push('WhatsApp com DDD');
      if (!(p.city || '').trim()) missing.push('cidade');
      if (!(p.state || '').trim()) missing.push('estado (UF)');

      const techMsg = lastPersistError?.message;
      const techCode = lastPersistError?.code;
      let description: string;
      if (missing.length > 0) {
        description = `Falta preencher: ${missing.join(', ')}. Toque em "Voltar" e complete esses campos.`;
      } else if (techMsg) {
        description = `Erro técnico: ${techMsg.slice(0, 180)}${techCode ? ` [cod: ${techCode}]` : ''}. Toque em "Tentar novamente".`;
      } else {
        description = 'Sua conexão pode ter caído. Toque em "Tentar novamente" — se persistir, reporte ao suporte.';
      }

      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user?.id,
        meta: {
          code: WIZARD_ERROR_CODES.PERSIST_FIRST_SERVICE_NO_PROVIDER,
          missing_fields: missing,
          tech_message: techMsg || null,
          tech_code: techCode || null,
          used_fresh_profile: !!freshProfile,
        },
      });

      toast.error('Não conseguimos preparar seu perfil agora', {
        description,
          action: {
            label: missing.length > 0 ? 'Voltar e completar' : 'Tentar novamente',
            onClick: () => {
              if (missing.length > 0) {
                void import('@/lib/wizardBackNav').then(({ requestWizardBackForPhase }) => {
                  requestWizardBackForPhase({
                    phase: state.phase,
                    source: 'error_toast',
                    editMode,
                    meta: { code: WIZARD_ERROR_CODES.PERSIST_FIRST_SERVICE_NO_PROVIDER },
                  });
                });
              } else {
                void persistFirstService();
              }
            },
          },
        duration: 12000,
      });
      // Modal claro com detalhes técnicos (não mascara, complementa o toast).
        setErrorModal({
        code: WIZARD_ERROR_CODES.PERSIST_FIRST_SERVICE_NO_PROVIDER,
        missingFields: missing,
        techMessage: techMsg ?? null,
        techCode: techCode ?? null,
        onRetry: () => { void persistFirstService(); },
      });
      return false;
    }
    setSaving(true);
    // FASE 1.6.8 — pre-atomic operation boundary.
    {
      const op = buildPersistFirstServiceOperation({
        userId: user.id,
        providerId: workingProviderId,
        categoryId: state.service.category_ids[0] || null,
        fullName: state.profile.full_name || '',
        whatsappDigits: (state.profile.whatsapp || '').replace(/\D/g, ''),
        city: state.profile.city || '',
        state: state.profile.state || '',
      });
      if (!op.ok) {
        const fail = op as { ok: false; code: string; reason: string };
        await logOperationBuildFailure('onboarding_v2_persist_first_service', fail as any);
        setSaving(false);

        // Mapa: motivo técnico → (label humano em pt-BR + fase do wizard para corrigir + campo focável).
        // Garante que o usuário NUNCA veja "Complete os campos obrigatórios" sem saber QUAL campo falta.
        // Containment patch — Crítico #1: aponta para `phase_repair_contact`
        // (fase auxiliar fora do PHASE_ORDER) em vez da extinta `phase1_basic`.
        // Sem isso, "Voltar e corrigir" era um beco sem saída.
        const REASON_MAP: Record<string, { label: string; backPhase: any; field: string }> = {
          full_name_required:      { label: 'Nome completo',         backPhase: 'phase_repair_contact', field: 'full_name' },
          whatsapp_required:       { label: 'WhatsApp com DDD',      backPhase: 'phase_repair_contact', field: 'whatsapp' },
          city_and_state_required: { label: 'Cidade e estado (UF)',  backPhase: 'phase_repair_contact', field: 'city' },
          category_required:       { label: 'Categoria do serviço',  backPhase: 'phase2_service',       field: 'service_name' },
          provider_required:       { label: 'Perfil de prestador',   backPhase: 'phase_repair_contact', field: 'full_name' },
          user_required:           { label: 'Sessão de login',       backPhase: 'phase_repair_contact', field: 'full_name' },
        };
        const info = REASON_MAP[fail.reason] || { label: fail.reason, backPhase: state.phase, field: '' };
        const description = `Falta preencher: ${info.label}. Toque em "Voltar e corrigir" — vamos te levar direto ao campo (ele vai piscar em vermelho).`;

        void trackEvent({
          phase: state.phase,
          event: 'error',
          userId: user?.id,
          meta: {
            code: 'persist_first_service_op_build_failed',
            op_code: fail.code,
            op_reason: fail.reason,
            missing_field: info.field,
            back_phase: info.backPhase,
          },
        });

        const goBackAndFocus = () => {
          // Marca o campo a destacar piscando ao chegar na fase de destino.
          try {
            sessionStorage.setItem('onboarding-v2:focus-field', info.field);
          } catch { /* fail-soft */ }
          // Containment patch — Crítico #1: se o destino é a fase auxiliar de
          // reparo, despacha GO_TO_REPAIR direto (atalho síncrono) em vez de
          // depender do orquestrador de Voltar, que não conhece essa fase.
          if (info.backPhase === 'phase_repair_contact') {
            dispatch({ type: 'GO_TO_REPAIR', from: state.phase } as any);
            return;
          }
          void import('@/lib/wizardBackNav').then(({ requestWizardBackForPhase }) => {
            requestWizardBackForPhase({
              phase: state.phase,
              source: 'error_toast',
              editMode,
              meta: {
                code: 'persist_first_service_op_build_failed',
                target_phase: info.backPhase,
                missing_field: info.field,
              },
            });
          });
        };

        toast.error('Complete os campos obrigatórios para publicar o serviço', {
          description,
          action: { label: 'Voltar e corrigir', onClick: goBackAndFocus },
          duration: 15000,
        });

        // Modal claro: lista o campo faltante em pt-BR e oferece CTA de correção.
        setErrorModal({
          code: 'persist_first_service_op_build_failed',
          missingFields: [info.label],
          techMessage: `reason: ${fail.reason}`,
          techCode: fail.code,
          onRetry: goBackAndFocus,
        });
        return false;
      }
    }
    // FASE 1.6.3 — tracker multi-write: providers.update + services create + finalize.
    // NÃO altera fluxo: apenas observa e impede sucesso falso se finalize falhar.
    const { createSyncTracker, logSyncFailure } = await import('@/lib/multiWriteSync');
    const sync = createSyncTracker();
    try {
      const s = state.service;
      const p = state.profile;
      const cityForAddress = [p.city, p.state].filter(Boolean).join(' - ');
      const serviceArea = s.cities_served.join('; ');
      const workingHoursSummary = buildWorkingHoursSummary(s.working_hours, s.working_days);

      // ── INVARIANTE OBRIGATÓRIA ─────────────────────────────────────────────
      // O nome do 1º serviço é SEMPRE o nome oficial da categoria escolhida e
      // o primary_category_id do prestador recebe o MESMO category_id.
      // Resolvemos o nome via banco para evitar divergência de cache local.
      const categoryId = s.category_ids[0] || null;
      if (!categoryId) {
        toast.error('Selecione uma categoria antes de publicar o serviço.');
        setSaving(false);
        return false;
      }
      let resolvedCategoryName = (s.service_name || '').trim();
      try {
        const { data: catRow } = await supabase
          .from('categories')
          .select('name')
          .eq('id', categoryId)
          .maybeSingle();
        if (catRow?.name) resolvedCategoryName = catRow.name;
      } catch { /* fallback no nome local */ }
      if (!resolvedCategoryName) {
        toast.error('Categoria inválida. Escolha novamente.');
        setSaving(false);
        return false;
      }
      // Sincroniza estado local com o nome canônico (mantém UI consistente).
      const localName = (s.service_name || '').trim();
      const localPrimary = state.profile.primary_category_id;
      const nameMismatch = localName.toLowerCase() !== resolvedCategoryName.trim().toLowerCase();
      const primaryMismatch = localPrimary !== categoryId;
      if (nameMismatch || primaryMismatch) {
        // LOG DE DIVERGÊNCIA — registra no console + telemetria para correção imediata.
        const divergence = {
          where: 'persistFirstService.invariant_check',
          categoryId,
          resolvedCategoryName,
          localName,
          localPrimaryCategoryId: localPrimary,
          nameMismatch,
          primaryMismatch,
        };
        console.warn('[onboardingV2] divergência categoria/serviço detectada e auto-corrigida:', divergence);
        void trackEvent({
          phase: state.phase,
          event: 'error',
          userId: user?.id,
          meta: { reason: 'category_service_divergence', ...divergence },
        });
      }
      if (nameMismatch) {
        dispatch({ type: 'PATCH_SERVICE', patch: { service_name: resolvedCategoryName } });
      }
      if (primaryMismatch) {
        dispatch({ type: 'PATCH_PROFILE', patch: { primary_category_id: categoryId } });
      }

      // ── ANTI-DUPLICAÇÃO ────────────────────────────────────────────────────
      // Antes de criar, verifica se este provider já tem serviço dessa
      // categoria (ou nome). Se tiver, reusa o ID — evita duplicar registros
      // e estourar a cota de serviços do plano.
      // Rastreia o ID resolvido localmente — `dispatch` não atualiza
      // `state.firstServiceId` no mesmo tick, então o read-back abaixo
      // precisa de uma referência síncrona.
      let resolvedServiceId: string | null = state.firstServiceId;
      // Containment patch — Crítico #2: flag p/ disparar UPDATE de detalhes
      // (cidades/horários/descrição) quando o serviço já existia ANTES desta
      // chamada (early-persist em phase2_service ou reuse por findExisting).
      // Sem isso, dados coletados em phase2_details eram silenciosamente
      // ignorados quando o early-persist tinha criado o esqueleto.
      let reusedExistingService = false;
      if (resolvedServiceId) {
        // Estado local já tem ID → confiar e seguir para herança/conclusão.
        reusedExistingService = true;
      } else {
        const reusedId = await findExistingFirstService(
          workingProviderId,
          categoryId,
          resolvedCategoryName,
        );
        if (reusedId) {
          // Mesmo reusando, force-aligna nome + category_id no service E
          // primary_category_id no provider — TUDO numa única transação
          // via RPC `realign_first_service` (SECURITY DEFINER, dono-only).
          const { data: realignData, error: realignErr } = await (supabase as any).rpc(
            'realign_first_service',
            {
              _service_id: reusedId,
              _provider_id: workingProviderId,
              _category_id: categoryId,
            },
          );
          if (realignErr || !realignData?.success) {
            console.warn('[onboardingV2] realign_first_service falhou:', realignErr || realignData);
            void trackEvent({
              phase: state.phase,
              event: 'error',
              userId: user?.id,
              meta: {
                reason: 'realign_first_service_failed',
                error: realignErr?.message || realignData?.error || 'unknown',
                serviceId: reusedId,
                providerId: workingProviderId,
                categoryId,
              },
            });
            // Fallback defensivo: tenta UPDATE direto (mantém comportamento legado).
            // Resultado agora é checado e auditado (antes era silencioso).
            const { error: fallbackUpdErr } = await supabase
              .from('services')
              .update({ service_name: resolvedCategoryName, category_id: categoryId })
              .eq('id', reusedId);
            if (fallbackUpdErr) {
              void trackEvent({
                phase: state.phase,
                event: 'error',
                userId: user?.id,
                meta: {
                  kind: 'realign_fallback_update_failed',
                  error_code: (fallbackUpdErr as any)?.code || null,
                  error_message: String(fallbackUpdErr.message || '').slice(0, 240),
                  service_id: reusedId,
                  provider_id: workingProviderId,
                  category_id: categoryId,
                },
              });
            }
          }
          resolvedServiceId = reusedId;
          dispatch({ type: 'SET_FIRST_SERVICE_ID', id: reusedId });
          reusedExistingService = true;
        } else {
          // ── PRÉ-VALIDAÇÃO LOCAL (Hotfix #2) ─────────────────────────────────
          // Garante que os campos NOT NULL chegam preenchidos. Se faltar algo,
          // registra telemetria detalhada e tenta recuperar do state global.
          const preflightFailures: string[] = [];
          if (!workingProviderId) preflightFailures.push('provider_id');
          if (!categoryId) preflightFailures.push('category_id');
          if (!resolvedCategoryName) preflightFailures.push('service_name');
          if (preflightFailures.length > 0) {
            void trackEvent({
              phase: state.phase,
              event: 'error',
              userId: user?.id,
              meta: {
                code: WIZARD_ERROR_CODES.PERSIST_FIRST_SERVICE_PRECHECK_FAILED,
                missing: preflightFailures,
                provider_id: workingProviderId || null,
                category_id: categoryId || null,
                has_service_name: Boolean(resolvedCategoryName),
              },
            });
            // Tentativa de recuperação: re-resolve providerId via state/banco
            if (!workingProviderId) {
              workingProviderId = await ensureProviderId();
            }
            if (!workingProviderId || !categoryId || !resolvedCategoryName) {
              void trackEvent({
                phase: state.phase,
                event: 'error',
                userId: user?.id,
                meta: {
                  code: WIZARD_ERROR_CODES.PERSIST_FIRST_SERVICE_PRECONDITION_FAILED,
                  has_provider_id: Boolean(workingProviderId),
                  has_category_id: Boolean(categoryId),
                  has_category_name: Boolean(resolvedCategoryName),
                },
              });
              toast.error('Não conseguimos registrar seu serviço principal.', {
                description: 'Verifique se a categoria está correta e tente novamente.',
                duration: 10000,
              });
              return false;
            }
          }

          // 1) RPC oficial — cria serviço atomicamente
          const rpcPayload = {
            _provider_id: workingProviderId,
            _service_name: resolvedCategoryName, // ← invariante reforçada
            _description: s.description || '',
            _whatsapp: p.whatsapp,
            _service_area: serviceArea,
            _address: cityForAddress,
            _working_hours: workingHoursSummary,
            _website: '',
            _instagram_url: '',
            _facebook_url: '',
            _youtube_url: '',
            _category_id: categoryId,
            _category_ids: [categoryId, ...s.category_ids.slice(1)],
          };
          const { data, error } = await (supabase as any).rpc('create_service_atomic', rpcPayload);

          if (error || !data?.success) {
            // ── OBSERVABILIDADE TOTAL (Hotfix #1) ─────────────────────────────
            void trackEvent({
              phase: state.phase,
              event: 'error',
              userId: user?.id,
              meta: {
                reason: 'create_service_atomic_failed',
                error_code: error?.code || null,
                error_message: error?.message || data?.error || null,
                error_details: error?.details ? String(error.details).slice(0, 300) : null,
                error_hint: error?.hint || null,
                rpc_success: data?.success ?? null,
                provider_id: workingProviderId,
                category_id: categoryId,
                has_whatsapp: Boolean(p.whatsapp),
                cities_count: s.cities_served.length,
              },
            });
            console.warn('[onboardingV2] create_service_atomic falhou — tentando fallback INSERT direto', {
              error, data,
            });

            // ── FALLBACK RESILIENTE (Hotfix #3) ───────────────────────────────
            // Plano B: INSERT direto na tabela `services`. As políticas RLS
            // permitem o dono do provider inserir seu próprio serviço.
            //
            // ── IDEMPOTÊNCIA (Hotfix #5) ──────────────────────────────────────
            // Antes do INSERT, refaz o lookup. Se o RPC falhou parcialmente
            // (ex: timeout depois de inserir a row, ou rede caindo no retorno),
            // o serviço pode JÁ existir. Sem essa guarda, um reenvio do usuário
            // criaria um registro duplicado e estouraria a cota do plano.
            try {
              const preInsertReusedId = await findExistingFirstService(
                workingProviderId,
                categoryId,
                resolvedCategoryName,
              );
              if (preInsertReusedId) {
                void trackEvent({
                  phase: state.phase,
                  event: 'submit',
                  userId: user?.id,
                  meta: {
                    reason: 'fallback_insert_skipped_idempotent',
                    service_id: preInsertReusedId,
                    provider_id: workingProviderId,
                    category_id: categoryId,
                  },
                });
                resolvedServiceId = preInsertReusedId;
                dispatch({ type: 'SET_FIRST_SERVICE_ID', id: preInsertReusedId });
                // Pula o INSERT inteiro — segue o fluxo de herança/conclusão.
                // (O bloco `else` do RPC abaixo é só para o caminho feliz; aqui
                // já temos o serviço resolvido por idempotência, então o
                // try/catch do fallback simplesmente termina sem inserir.)
              } else {
              const { data: insertRow, error: insertErr } = await supabase
                .from('services')
                .insert({
                  provider_id: workingProviderId,
                  service_name: resolvedCategoryName,
                  description: s.description || '',
                  whatsapp: p.whatsapp || null,
                  service_area: serviceArea || null,
                  address: cityForAddress || null,
                  working_hours: workingHoursSummary || null,
                  working_hours_struct: s.working_hours_struct ?? null,
                  category_id: categoryId,
                  category_ids: [categoryId, ...s.category_ids.slice(1)],
                } as any)
                .select('id')
                .single();

              if (insertErr || !insertRow?.id) {
                void trackEvent({
                  phase: state.phase,
                  event: 'error',
                  userId: user?.id,
                  meta: {
                    reason: 'fallback_insert_services_failed',
                    error_code: (insertErr as any)?.code || null,
                    error_message: insertErr?.message || null,
                    error_details: (insertErr as any)?.details
                      ? String((insertErr as any).details).slice(0, 300) : null,
                    provider_id: workingProviderId,
                    category_id: categoryId,
                  },
                });
                throw new Error(
                  insertErr?.message || error?.message || data?.error || 'Falha ao criar serviço',
                );
              }

              // Fallback bem-sucedido → registra e segue como criação válida
              void trackEvent({
                phase: state.phase,
                event: 'submit',
                userId: user?.id,
                meta: {
                  reason: 'fallback_insert_services_succeeded',
                  service_id: insertRow.id,
                  provider_id: workingProviderId,
                  category_id: categoryId,
                },
              });
              resolvedServiceId = insertRow.id;
              dispatch({ type: 'SET_FIRST_SERVICE_ID', id: insertRow.id });
              }
            } catch (fallbackErr: any) {
              // Plano C — feedback amigável (Hotfix #4) e propaga para o catch externo
              throw new Error(
                fallbackErr?.message ||
                'Não conseguimos registrar seu serviço principal. Verifique se a categoria está correta e tente novamente.',
              );
            }
          } else {
            resolvedServiceId = data.service_id;
            dispatch({ type: 'SET_FIRST_SERVICE_ID', id: data.service_id });
          }
        }
      }

      // ── SYNC DE DETALHES EM RESERVA (Containment Crítico #2) ────────────
      // Se o serviço JÁ existia (early-persist em phase2_service, reuso via
      // findExisting ou state com firstServiceId), a row tem só o esqueleto
      // mínimo. Aplicamos UPDATE idempotente para garantir que cidades,
      // horários e descrição coletados depois sejam persistidos. Sem isso,
      // chamadas subsequentes ao persistFirstService perdiam silenciosamente
      // os dados de phase2_details.
      if (reusedExistingService && resolvedServiceId) {
        const detailsPatch: Record<string, any> = {
          service_name: resolvedCategoryName,
          category_id: categoryId,
          category_ids: [categoryId, ...s.category_ids.slice(1)],
        };
        // Mapa fonte→campo para registrar quais opcionais foram pulados
        // (draft incompleto). Observabilidade pura: NÃO altera o patch.
        const optionalSources: Array<{ key: string; present: boolean }> = [
          { key: 'description',          present: !!(s.description || '').trim() },
          { key: 'whatsapp',             present: !!(p.whatsapp || '').trim() },
          { key: 'service_area',         present: !!serviceArea },
          { key: 'address',              present: !!cityForAddress },
          { key: 'working_hours',        present: !!workingHoursSummary },
          { key: 'working_hours_struct', present: !!s.working_hours_struct },
        ];
        if ((s.description || '').trim()) detailsPatch.description = s.description;
        if ((p.whatsapp || '').trim()) detailsPatch.whatsapp = p.whatsapp;
        if (serviceArea) detailsPatch.service_area = serviceArea;
        if (cityForAddress) detailsPatch.address = cityForAddress;
        if (workingHoursSummary) detailsPatch.working_hours = workingHoursSummary;
        if (s.working_hours_struct) detailsPatch.working_hours_struct = s.working_hours_struct;
        const fieldsSkipped = optionalSources.filter((o) => !o.present).map((o) => o.key);
        const { error: detErr } = await supabase
          .from('services')
          .update(detailsPatch)
          .eq('id', resolvedServiceId);
        if (detErr) {
          console.warn('[onboardingV2] sync details on reused service failed', detErr);
          void trackEvent({
            phase: state.phase,
            event: 'error',
            userId: user?.id,
            meta: {
              kind: 'reused_service_details_sync_failed',
              service_id: resolvedServiceId,
              error_code: (detErr as any)?.code || null,
              error_message: detErr.message?.slice(0, 240) || null,
              fields_attempted: Object.keys(detailsPatch),
              fields_skipped: fieldsSkipped,
            },
          });
        } else {
          void trackEvent({
            phase: state.phase,
            event: 'submit',
            userId: user?.id,
            meta: {
              kind: 'reused_service_details_synced',
              service_id: resolvedServiceId,
              fields: Object.keys(detailsPatch),
              fields_skipped: fieldsSkipped,
            },
          });
        }
      }

      // 2) Herança — categoria principal + horário sobem para o provider
      const updates: any = { category_id: categoryId };
      if (workingHoursSummary) updates.working_hours = workingHoursSummary;
      if (s.working_hours_struct) updates.working_hours_struct = s.working_hours_struct;
      if (s.starting_price_brl != null) updates.starting_price = s.starting_price_brl;
      {
        const { error: provUpdErr } = await supabase.from('providers').update(updates).eq('id', workingProviderId);
        if (provUpdErr) {
          sync.mark('provider', false);
          await logSyncFailure({
            action: 'persist_first_service_sync_failed',
            source: 'persist_first_service.provider_update',
            snapshot: sync.snapshot(),
            errorCode: (provUpdErr as any).code || 'provider_update_failed',
          });
        } else {
          sync.mark('provider', true);
          if (resolvedServiceId) sync.mark('service', true);
        }
      }

      // ── READ-BACK INVARIANTE (fail-loud, auto-heal) ────────────────────────
      // Confirma no banco que:
      //   services.service_name === categories.name (do categoryId escolhido)
      //   services.category_id  === categoryId
      //   providers.category_id === categoryId
      // Se algo divergir, executa UPDATE corretivo e registra telemetria.
      // Se a correção falhar, aborta e mostra erro ao usuário.
      try {
        const sid = resolvedServiceId;
        if (sid) {
          const [{ data: svcRow }, { data: provRow }] = await Promise.all([
            supabase.from('services').select('service_name, category_id').eq('id', sid).maybeSingle(),
            supabase.from('providers').select('category_id').eq('id', workingProviderId).maybeSingle(),
          ]);
          const dbName = (svcRow?.service_name || '').trim();
          const dbSvcCat = svcRow?.category_id || null;
          const dbProvCat = (provRow as any)?.category_id || null;
          const svcNameOk = dbName.toLowerCase() === resolvedCategoryName.toLowerCase();
          const svcCatOk = dbSvcCat === categoryId;
          const provCatOk = dbProvCat === categoryId;
          if (!svcNameOk || !svcCatOk || !provCatOk) {
            const drift = {
              where: 'persistFirstService.readback_invariant',
              serviceId: sid,
              categoryId,
              expectedName: resolvedCategoryName,
              dbServiceName: dbName,
              dbServiceCategoryId: dbSvcCat,
              dbProviderCategoryId: dbProvCat,
            };
            console.warn('[onboardingV2] read-back drift detectado, aplicando correção:', drift);
            void trackEvent({
              phase: state.phase,
              event: 'error',
              userId: user?.id,
              meta: { reason: 'first_service_invariant_drift', ...drift },
            });
            // Auto-heal: aplica realinhamento atômico via RPC.
            const { data: healData, error: healErr } = await (supabase as any).rpc(
              'realign_first_service',
              {
                _service_id: sid,
                _provider_id: workingProviderId,
                _category_id: categoryId,
              },
            );
            if (healErr || !healData?.success) {
              // Fallback: 2 UPDATEs separados (não atômico, mas tenta resolver)
              const fixSvc = supabase
                .from('services')
                .update({ service_name: resolvedCategoryName, category_id: categoryId })
                .eq('id', sid);
              const fixProv = supabase
                .from('providers')
                .update({ category_id: categoryId })
                .eq('id', workingProviderId);
              const [r1, r2] = await Promise.all([fixSvc, fixProv]);
              if (r1.error || r2.error) {
                toast.error('Não foi possível alinhar a categoria do serviço. Tente novamente.');
                return false;
              }
            }
          }
        }
      } catch (readbackErr: any) {
        // Read-back é defensivo — não derruba o fluxo se a leitura falhar,
        // mas registra para auditoria.
        console.warn('[onboardingV2] read-back falhou (não bloqueante):', readbackErr?.message);
      }

      // 3) Marca onboarding completo via entrypoint único `finalizeOnboarding`.
      // A categoria principal vive em providers.category_id (já atualizada
      // acima); profiles.primary_category_id é apenas estado de UI no wizard.
      // O entrypoint também libera o active-session lock e limpa drafts.
      // FAIL-LOUD: se a finalização (UPDATE profiles + RPC atômica) falhar,
      // NÃO podemos mentir para o usuário — abortamos o fluxo, mostramos
      // toast com retry e mantemos o wizard aberto.
      const finalizeResult = await finalizeOnboarding({
        userId: user.id,
        extraProfilePatch: { profile_type: 'provider' },
      });
      if (!finalizeResult.ok) {
        const finalizeErr: any = finalizeResult.error;
        // FASE 1.6.3 — service+provider OK mas finalize falhou. Audit explícito
        // para detectar onboarding em estado intermediário (não-concluído).
        // CRÍTICO: NÃO marcamos onboarding como concluído nem mostramos sucesso falso.
        sync.setFailed('profile');
        await logSyncFailure({
          action: 'persist_first_service_sync_failed',
          source: 'persist_first_service.finalize',
          snapshot: sync.snapshot(),
          errorCode: (finalizeErr as any)?.code || 'finalize_failed',
        });
        logWizardError({
          phase: state.phase,
          userId: user?.id,
          error: finalizeErr instanceof Error ? finalizeErr : new Error(String(finalizeErr ?? 'finalize_failed')),
          variant: 'v2',
          context: { action: 'finalize_onboarding_after_first_service' },
        });
        toast.error('Não foi possível concluir seu cadastro agora.', {
          description: 'Seu serviço foi salvo. Tente finalizar novamente em instantes.',
          duration: 10000,
          action: { label: 'Tentar novamente', onClick: () => { void persistFirstService(); } },
        });
        return false;
      }

      // Notifica o checklist do dashboard pra atualizar imediatamente
      try { window.dispatchEvent(new CustomEvent('onboarding-progress-changed')); } catch { /* noop */ }

      return true;
    } catch (e: any) {
      // Telemetria final (Hotfix #1 — observabilidade total).
      // Mantém o erro COMPLETO (até 600 chars) na telemetria para análise técnica
      // mesmo quando o toast exibido ao usuário precisa ser curto.
      const fullMessage = String(e?.message || e || 'unknown');
      const truncatedMessage = fullMessage.length > 140
        ? fullMessage.slice(0, 137) + '...'
        : fullMessage;
      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user?.id,
        meta: {
          code: WIZARD_ERROR_CODES.PERSIST_FIRST_SERVICE_TERMINAL,
          error_code: e?.code || null,
          error_message: fullMessage.slice(0, 600),
          error_details: e?.details ? String(e.details).slice(0, 300) : null,
          error_hint: e?.hint || null,
          error_name: e?.name || null,
        },
      });
      logWizardError({ phase: state.phase, userId: user?.id, error: e, variant: 'v2', context: { action: 'publish_first_service', flow: isCompany ? 'company' : 'default', error_message_truncated: truncatedMessage } });
      toast.error('Não conseguimos registrar seu serviço principal.', {
        description: 'Verifique se a categoria está correta e tente novamente. Seu progresso foi salvo como rascunho — você pode continuar a qualquer momento.',
        duration: 12000,
        action: { label: 'Tentar novamente', onClick: () => { void persistFirstService(); } },
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ───── Persistência: patches incrementais Fase 4 ───── */
  const persistPatch = async (patch: Record<string, any>): Promise<boolean> => {
    if (!isTabLeader()) {
      void trackEvent({
        phase: state.phase,
        event: 'error',
        userId: user?.id,
        meta: { kind: 'write_blocked_non_leader', where: 'persistPatch' } as any,
      });
      return false;
    }
    if (!user) return true;
    setSaving(true);
    try {
      const workingProviderId = await ensureProviderId();
      if (!workingProviderId) {
        toast.error('Não conseguimos recuperar seu perfil agora. Tente novamente em instantes.');
        return false;
      }
      // tax_id é coluna SOMENTE de `profiles` — nunca enviar pra `providers`.
      // Se vier no patch, removemos antes de normalizar e mapeamos para cpf/cnpj
      // conforme o kind (PF → cpf, PJ → cnpj). Isso evita o erro
      // "Could not find the 'tax_id' column of 'providers'" reportado em produção.
      const { tax_id: incomingTaxId, ...rawProviderPatch } = patch as Record<string, any>;
      const providerPatch = withProviderLocationFallback(
        buildProviderSocialPatch(rawProviderPatch, state.profile),
        state.profile,
      );
      if (incomingTaxId) {
        const isPj = state.profile.kind === 'pj';
        if (isPj) providerPatch.cnpj = incomingTaxId;
        else providerPatch.cpf = incomingTaxId;
      }
      warnIfForbiddenAddress(providerPatch);
      const safe = normalizeProviderPayload(providerPatch);
      const { error } = await supabase.from('providers').update(safe as any).eq('id', workingProviderId);
      if (error) throw error;
      // Salva também tax_id no profile se vier — agora com checagem de erro
      // (antes o resultado era totalmente ignorado).
      if (incomingTaxId) {
        const { error: taxErr } = await supabase
          .from('profiles')
          .update({ tax_id: incomingTaxId })
          .eq('id', user.id);
        if (taxErr) {
          logWizardError({
            phase: state.phase,
            userId: user?.id,
            error: taxErr,
            variant: 'v2',
            context: { action: 'persist_patch_tax_id' },
          });
        }
      }
      try { window.dispatchEvent(new CustomEvent('onboarding-progress-changed')); } catch { /* noop */ }
      return true;
    } catch (e: any) {
      const parsed = parseProviderIntegrityError(e);
      if (parsed.matched) {
        dispatchProviderIntegrityFocus(parsed);
        toast.error(parsed.title, {
          description: parsed.description,
          action: { label: parsed.ctaLabel, onClick: () => dispatchProviderIntegrityFocus(parsed) },
        });
      }
      logWizardError({ phase: state.phase, userId: user?.id, error: e, variant: 'v2', context: { action: 'persist_patch', keys: Object.keys(patch || {}), flow: isCompany ? 'company' : 'default' } });
      if (!parsed.matched) {
        toast.error('Não consegui salvar este passo agora', {
          description: (e?.message || '').slice(0, 160) || undefined,
          action: { label: 'Tentar novamente', onClick: () => { void persistPatch(patch); } },
        });
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ───── Telemetria helpers ───── */
  const track = (event: 'next' | 'back' | 'skip' | 'submit' | 'error', meta: Record<string, unknown> = {}) => {
    // Áudio leve sincronizado com a transição. Respeita reduced-motion via cooldown.
    if (event === 'next') playWizardTransition('next');
    else if (event === 'back') playWizardTransition('back');
    else if (event === 'skip') playWizardTransition('skip');
    void trackEvent({ phase: state.phase, event, userId: user?.id, meta });
  };

  /* ───── Render por fase ───── */

  const finishWizard = async () => {
    // FAIL-LOUD: o usuário SEMPRE precisa sair do wizard ao chegar em `done`,
    // MAS apenas se a transação do banco realmente concluiu. Se
    // `finalizeOnboarding` retornar !ok, NÃO navegamos para a tela de sucesso
    // — caso contrário ficamos com falso-sucesso (perfil não marcado como
    // completo, mas usuário levado a /sucesso e depois ao dashboard, onde o
    // Gate o jogará de volta ao wizard, gerando loop).
    if (user?.id) {
      const result = await finalizeOnboarding({
        userId: user.id,
        extraProfilePatch: { profile_type: 'provider' },
      });
      if (!result.ok) {
        const finalizeErr: any = result.error;
        logWizardError({
          phase: state.phase,
          userId: user?.id,
          error: finalizeErr instanceof Error ? finalizeErr : new Error(String(finalizeErr ?? 'finalize_failed')),
          variant: 'v2',
          context: { action: 'finish_wizard' },
        });
        toast.error('Não foi possível concluir seu cadastro agora.', {
          description: 'Verifique sua conexão e tente novamente — seus dados foram salvos.',
          duration: 12000,
          action: { label: 'Tentar novamente', onClick: () => { void finishWizard(); } },
        });
        return;
      }
      try { await refetchProfile?.(); } catch (e) {
        // Refetch é só de UI — não bloqueia, mas registra para auditoria.
        console.warn('[finishWizard] refetchProfile failed (non-blocking)', e);
      }
    }

    toast.success('Perfil completo! Bem-vindo.');
    navigate('/onboarding-v2/sucesso', { replace: true });
  };

  const continueWithoutFirstService = async () => {
    if (!user?.id) return;

    appendWizardResetDebugLog({
      source: 'onboarding-v2-skip-first-service',
      route: `${location.pathname}${location.search}`,
      phase: state.phase,
      nextRoute: 'phase4_document',
      reason: 'continue-profile-without-first-service',
      meta: {
        providerId: state.providerId,
        internalHandoffFromTriage,
        pendingCoreFields,
      },
    });

    setSaving(true);
    try {
      dispatch({ type: 'GO_TO', phase: 'phase4_document' });
    } catch (e: any) {
      track('error', { reason: 'skip_first_service_failed', message: e?.message || null });
      toast.error('Não consegui continuar sem o serviço agora. ' + (e?.message || 'Tente de novo.'));
    } finally {
      setSaving(false);
    }
  };

  // Contagem de fotos em tempo real para o checklist dinâmico do
  // WizardEncouragement (phase2_service/details/photos). Atualiza via
  // postgres_changes quando o usuário sobe/remove imagem em service_images.
  const photoCount = useServicePhotoCount(state.firstServiceId);

  // Status do auto-retry de "Recuperar rascunho do serviço" no card de
  // bloqueio de phase2_photos. Permite mostrar banner de progresso/falha
  // ao usuário sem depender só de toast (que pode ser dismissado rápido).
  const [phase2RetryStatus, setPhase2RetryStatus] =
    useState<'idle' | 'running' | 'failed'>('idle');

  const renderPhase = () => {
    switch (state.phase) {
      // phase1_action / phase1_kind / phase1_location / phase1_contact
      // foram removidas em mai/2026 (consolidação Bet Mode). Esses dados
      // agora vêm 100% da triagem; a fase principal começa em phase2_service.
      case 'phase2_service':
        return (
          <>
            <Phase2Service
              service={state.service}
              profile={state.profile}
              onChangeService={patchService}
              onChangeProfile={patchProfile}
              onBack={() => {
                // phase2_service é a 1ª fase viva do V2. O Voltar delega ao
                // WizardShell via helper canônico (`requestWizardBack`), que
                // centraliza telemetria + nome do evento + guard de fallback.
                track('back');
                import('@/lib/wizardBackNav').then(({ requestWizardBack }) => {
                  requestWizardBack({ phase: 'phase2_service', source: 'phase2_service' });
                });
              }}
              onNext={async () => {
                track('next');
                // Containment patch — Crítico #2: persist EARLY antes de
                // avançar. Best-effort (silencioso): se falhar, segue mesmo
                // assim — o persistFirstService completo cobre em phase2_details.
                try { await persistFirstServiceEarly(); } catch { /* fail-soft */ }
                dispatch({ type: 'NEXT' });
              }}
              firstServiceId={state.firstServiceId}
              onSkip={() => {
                // BLINDAGEM (regression-locked): "Pular o 1º serviço" NUNCA
                // navega para o dashboard. Em vez disso, registra a intenção
                // via `continueWithoutFirstService`, que despacha
                // GO_TO phase4_document e permite o usuário concluir o cadastro
                // sem um serviço (selo "perfil incompleto" segue tratado pelo
                // gate). Validado por `onboarding-v3-skip-first-service-e2e`.
                track('skip', { milestone: 'skip_first_service', target: 'phase4_document' });
                continueWithoutFirstService();
              }}
            />
            <WizardEncouragement
              title="Você está a 3 passos do seu 1º anúncio"
              description="Cadastre o serviço, capriche nos detalhes e adicione fotos — clientes da sua região já estão buscando."
              items={[
                { label: `Serviço${(state.service.service_name || '').trim() ? ' — pronto' : ''}`, done: !!(state.service.service_name || '').trim() && (state.service.category_ids?.length ?? 0) > 0 },
                { label: `Detalhes${(state.service.description || '').trim().length >= 10 ? ' — pronto' : ''}`, done: (state.service.description || '').trim().length >= 10 },
                { label: `Fotos${photoCount > 0 ? ` — ${photoCount}/5` : ''}`, done: photoCount > 0 },
              ]}
              nextStep={
                !(state.service.category_ids?.length ?? 0)
                  ? 'Escolha a categoria do serviço.'
                  : !(state.service.service_name || '').trim()
                    ? 'Dê um nome curto e claro ao serviço.'
                    : (state.service.description || '').trim().length < 10
                      ? 'Escreva uma descrição (mín. 10 caracteres).'
                      : 'Tudo pronto — pode salvar e continuar.'
              }
            />
          </>
        );
      case 'phase2_details':
        return (
          <>
            <Phase2Details
              service={state.service}
              profile={state.profile}
              onChangeService={patchService}
              onChangeProfile={patchProfile}
              onBack={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase2_service' }); }}
              saving={saving}
              onSkip={async () => {
                // [FIX 2026-05-02] "Pular detalhes" NÃO joga mais para o dashboard.
                // Salva o serviço (criando o firstServiceId) e segue para
                // phase2_photos, mantendo o circuito viciante e permitindo voltar.
                // Se a persistência falhar, mostra toast e mantém o usuário na fase.
                track('skip', { milestone: 'first_service_save_continue', target: 'phase2_photos' });
                const ok = await persistFirstService();
                if (ok) {
                  toast.success('Serviço salvo! Agora adicione fotos para destacar seu trabalho.');
                  dispatch({ type: 'GO_TO', phase: 'phase2_photos' });
                } else {
                  track('error', { reason: 'persist_service_failed' });
                  toast.error(
                    'Falta pouco! Não conseguimos salvar agora — revise os campos e tente novamente.',
                  );
                }
              }}
              onSubmit={async () => {
                track('submit');
                const ok = await persistFirstService();
                if (ok) { track('next'); dispatch({ type: 'NEXT' }); }
                else track('error', { reason: 'persist_service_failed' });
              }}
            />
            <WizardEncouragement
              title="Detalhes vendem mais"
              description="Anúncios com descrição e horário recebem até 3× mais contatos — você pode pular e voltar depois."
              items={[
                { label: 'Serviço — pronto', done: !!(state.service.service_name || '').trim() },
                { label: `Detalhes${(state.service.cities_served?.length ?? 0) > 0 && (state.service.working_hours || '').trim() ? ' — completo' : ''}`, done: (state.service.cities_served?.length ?? 0) > 0 && (state.service.working_hours || '').trim().length > 0 },
                { label: `Fotos${photoCount > 0 ? ` — ${photoCount}/5` : ''}`, done: photoCount > 0 },
              ]}
              nextStep={
                (state.service.cities_served?.length ?? 0) === 0
                  ? 'Adicione pelo menos 1 cidade onde você atende.'
                  : !(state.service.working_hours || '').trim()
                    ? 'Defina seus horários de atendimento.'
                    : 'Pode salvar e seguir para as fotos.'
              }
            />
          </>
        );
      case 'phase2_photos':
        if (!state.firstServiceId || !user?.id) {
          // Diagnóstico específico campo-a-campo em vez de tela em branco.
          const reason: 'no_service' | 'no_session' = !user?.id ? 'no_session' : 'no_service';
          const title = reason === 'no_session'
            ? 'Sua sessão expirou'
            : 'Ainda não consegui carregar seu serviço';

          // Lista exatamente quais campos faltam no draft local/state — assim
          // o usuário sabe se foi categoria, descrição ou cidade.
          const missing: string[] = [];
          if (reason === 'no_service') {
            const hasCategory =
              (state.service.category_ids?.length || 0) > 0 ||
              !!state.profile.primary_category_id;
            const hasName = !!(state.service.service_name || '').trim();
            const hasDesc = ((state.service.description || '').trim().length) >= 10;
            const hasCity = !!(state.profile.city || '').trim();
            if (!hasCategory) missing.push('categoria do serviço');
            if (!hasName) missing.push('nome do serviço');
            if (!hasDesc) missing.push('descrição (mínimo 10 caracteres)');
            if (!hasCity) missing.push('cidade');
          }

          const description = reason === 'no_session'
            ? 'Faça login novamente para continuar de onde parou. Seu cadastro foi salvo.'
            : missing.length > 0
              ? `Faltam estes campos para publicar o serviço antes das fotos:`
              : 'Para subir as fotos, primeiro preciso terminar de salvar seu serviço (categoria, descrição e cidade). Volte uma etapa, confirme os dados e tente novamente.';

          // Código canônico do bloqueio (consumido por logs/telemetria/error_reports).
          const blockCode = phase2PhotosBlockCode(reason);

          // Telemetria estruturada com o código exato — para suporte reproduzir.
          if (typeof window !== 'undefined' && !(window as any).__phase2BlockedLogged) {
            (window as any).__phase2BlockedLogged = true;
            console.warn(`[wizard] phase2_photos blocked: ${blockCode}`, {
              missing,
              providerId: state.providerId,
              firstServiceId: state.firstServiceId,
              hasUser: !!user?.id,
            });
            void trackEvent({
              phase: 'phase2_photos',
              event: 'error',
              userId: user?.id,
              meta: {
                code: blockCode,
                missing_fields: missing,
                has_provider: !!state.providerId,
                has_first_service: !!state.firstServiceId,
              },
            });
          }

          // Tenta recuperar firstServiceId com backoff exponencial.
          // 3 tentativas (0ms, 800ms, 2400ms) antes de marcar como falha — cobre
          // races transitórias entre create_service_atomic e mudança de fase.
          const handleRecoverDraft = async (opts?: { auto?: boolean }) => {
            const isAuto = !!opts?.auto;
            setPhase2RetryStatus('running');
            track('next', {
              code: isAuto
                ? WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_AUTO
                : WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_ATTEMPT,
            });
            const providerId = state.providerId;
            const categoryId =
              state.profile.primary_category_id || state.service.category_ids?.[0] || '';
            if (!providerId) {
              setPhase2RetryStatus('failed');
              if (!isAuto) {
                toast.message('Nada para recuperar', {
                  description: 'Volte para revisar o serviço e tente publicar novamente.',
                });
              }
              return false;
            }
            for (let attempt = 0; attempt < RECOVER_MAX_ATTEMPTS; attempt++) {
              const delay = recoverBackoffDelayMs(attempt);
              if (delay > 0) {
                await new Promise((r) => setTimeout(r, delay));
                track('next', {
                  code: WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_BACKOFF,
                  attempt: attempt + 1,
                  delay_ms: delay,
                });
              }
              try {
                const id = await findExistingFirstService(
                  providerId,
                  categoryId,
                  state.service.service_name || '',
                );
                if (id) {
                  dispatch({ type: 'SET_FIRST_SERVICE_ID', id });
                  setPhase2RetryStatus('idle');
                  track('next', {
                    code: WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_SUCCESS,
                    attempt: attempt + 1,
                  });
                  if (!isAuto) {
                    toast.success('Recuperamos seu serviço — pronto para subir as fotos.');
                  }
                  return true;
                }
              } catch (err: any) {
                // Em erro de rede/RLS: continua para a próxima tentativa.
                if (attempt === RECOVER_MAX_ATTEMPTS - 1) {
                  setPhase2RetryStatus('failed');
                  track('error', {
                    code: WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_EXHAUSTED,
                    attempts: RECOVER_MAX_ATTEMPTS,
                    message: String(err?.message || err).slice(0, 160),
                  });
                  if (!isAuto) {
                    toast.error('Não consegui recuperar o rascunho agora.', {
                      description: err?.message || 'Tente novamente em instantes.',
                    });
                  }
                  return false;
                }
              }
            }
            // Todas as tentativas retornaram null — sem registro encontrado.
            setPhase2RetryStatus('failed');
            track('error', {
              code: WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_EXHAUSTED,
              attempts: RECOVER_MAX_ATTEMPTS,
            });
            if (!isAuto) {
              toast.message('Nada para recuperar', {
                description: 'Volte para revisar o serviço e tente publicar novamente.',
              });
            }
            return false;
          };

          // Auto-retry: quando o bloqueio é por `no_service` e já temos um
          // providerId + ao menos categoria/nome do serviço, tentamos recuperar
          // automaticamente uma única vez por montagem deste card. Evita que o
          // usuário precise clicar para casos transitórios (ex.: race entre
          // criação do service e ida para fotos).
          if (
            typeof window !== 'undefined' &&
            reason === 'no_service' &&
            state.providerId &&
            !(window as any).__phase2AutoRetryDone
          ) {
            const canTry =
              !!state.profile.primary_category_id ||
              (state.service.category_ids?.length || 0) > 0 ||
              !!(state.service.service_name || '').trim();
            if (canTry) {
              (window as any).__phase2AutoRetryDone = true;
              void handleRecoverDraft({ auto: true });
            }
          }


          return (
            <section
              className="mx-auto w-full max-w-md space-y-3 px-4 py-5 text-center"
              role="alert"
              aria-live="polite"
              data-testid="phase2-photos-blocked"
            >
              <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
                <h2 className="font-display text-base font-extrabold text-amber-900 dark:text-amber-100">
                  {title}
                </h2>
                <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
                  {description}
                </p>
                {reason === 'no_service' && missing.length > 0 && (
                  <ul
                    data-testid="phase2-photos-missing-fields"
                    className="mx-auto mt-2 max-w-xs space-y-0.5 text-left text-xs text-amber-900 dark:text-amber-200"
                  >
                    {missing.map((m) => (
                      <li key={m} className="flex items-start gap-1.5">
                        <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-700" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Código: <code className="font-mono">phase2_photos:{reason}</code>
                </p>
                {reason === 'no_service' && phase2RetryStatus !== 'idle' && (
                  <div
                    data-testid="phase2-photos-retry-status"
                    data-status={phase2RetryStatus}
                    className={
                      phase2RetryStatus === 'running'
                        ? 'mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-100/60 px-2.5 py-1 text-[11px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100'
                        : 'mx-auto mt-2 flex max-w-xs flex-col items-center gap-1.5 rounded-md border border-rose-400/60 bg-rose-50/80 p-2 text-[11px] text-rose-900 dark:bg-rose-500/10 dark:text-rose-100'
                    }
                    role="status"
                    aria-live="polite"
                  >
                    {phase2RetryStatus === 'running' ? (
                      <>
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-700/40 border-t-amber-700" aria-hidden />
                        <span>Tentando recuperar seu rascunho automaticamente…</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">Não consegui recuperar automaticamente.</span>
                        <button
                          type="button"
                          data-testid="phase2-photos-retry-manual"
                          onClick={() => { void handleRecoverDraft(); }}
                          className="rounded-md border border-rose-400/60 bg-white/70 px-2 py-1 text-[11px] font-semibold text-rose-900 hover:bg-white dark:bg-rose-500/10 dark:text-rose-100"
                        >
                          Tentar manualmente
                        </button>
                      </>
                    )}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  {reason === 'no_session' ? (
                    <button
                      type="button"
                      onClick={() => { window.location.href = '/login?next=/cadastro-inicial'; }}
                      className="h-11 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-sm font-bold text-white shadow-md hover:opacity-95"
                    >
                      Fazer login novamente
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase2_details' }); }}
                        className="h-11 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-sm font-bold text-white shadow-md hover:opacity-95"
                      >
                        Voltar e revisar o serviço
                      </button>
                      <button
                        type="button"
                        data-testid="phase2-photos-recover-draft"
                        onClick={() => { void handleRecoverDraft(); }}
                        className="h-10 rounded-xl border border-amber-400/60 text-sm font-semibold text-amber-900 hover:bg-amber-100/60 dark:text-amber-100 dark:hover:bg-amber-500/10"
                      >
                        Recuperar rascunho do serviço
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => { track('skip', { reason: `blocked_${reason}` }); dispatch({ type: 'NEXT' }); }}
                    className="h-10 rounded-xl text-sm text-muted-foreground hover:text-foreground"
                  >
                    Pular fotos por enquanto
                  </button>
                </div>
              </div>
              <ReportWizardErrorButton
                step={`phase2_photos:${reason}`}
                componentName="OnboardingV2Shell"
                label="Reportar para o suporte"
                contextSnapshot={{
                  code: `phase2_photos:${reason}`,
                  missing_fields: missing,
                  category: state.profile.primary_category_id || state.service.category_ids?.[0] || null,
                  city: state.profile.city || null,
                  state: state.profile.state || null,
                  has_provider: !!state.providerId,
                  has_first_service: !!state.firstServiceId,
                  lastPersistError: lastPersistError
                    ? { message: lastPersistError.message, code: lastPersistError.code || null }
                    : null,
                }}
              />
            </section>
          );
        }
        return (
          <>
            <Phase2Photos
              serviceId={state.firstServiceId}
              userId={user.id}
              serviceName={state.service.service_name}
              onBack={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase2_details' }); }}
              onContinue={() => { track('next'); dispatch({ type: 'NEXT' }); }}
              onSkip={() => { track('skip'); dispatch({ type: 'NEXT' }); }}
            />
            <WizardEncouragement
              tone={photoCount > 0 ? 'celebrate' : 'gentle'}
              title={photoCount > 0 ? `Mandou bem! ${photoCount} foto${photoCount > 1 ? 's' : ''} no ar` : 'Última etapa do circuito principal'}
              description="Fotos bem feitas viram cliques. Mesmo 1 foto já libera o selo de anúncio completo."
              items={[
                { label: 'Serviço — pronto', done: true },
                { label: 'Detalhes — pronto', done: !!(state.service.description || '').trim() },
                { label: `Fotos — ${photoCount}/5`, done: photoCount > 0 },
              ]}
              nextStep={
                photoCount === 0
                  ? 'Suba pelo menos 1 foto ou pule por enquanto — você pode voltar depois.'
                  : photoCount < 3
                    ? 'Adicione mais fotos para destacar o anúncio (até 5).'
                    : 'Tudo pronto! Pode concluir e celebrar.'
              }
            />
          </>
        );
      case 'phase_repair_contact': {
        // Containment patch — Crítico #1: fase auxiliar para corrigir
        // WhatsApp/contato faltante sem perder o progresso do wizard.
        let focusField: string | null = null;
        try { focusField = sessionStorage.getItem('onboarding-v2:focus-field'); } catch { /* fail-soft */ }
        return (
          <PhaseRepairContact
            profile={state.profile}
            focusField={focusField}
            saving={saving}
            onSave={(patch) => {
              patchProfile(patch);
              try { sessionStorage.removeItem('onboarding-v2:focus-field'); } catch { /* noop */ }
              void trackEvent({
                phase: 'phase_repair_contact' as any,
                event: 'submit',
                userId: user?.id,
                meta: { kind: 'repair_contact_saved', fields: Object.keys(patch) },
              });
              dispatch({ type: 'RETURN_FROM_REPAIR' } as any);
            }}
            onCancel={() => { dispatch({ type: 'RETURN_FROM_REPAIR' } as any); }}
          />
        );
      }
      case 'phase3_celebration':
        return (
          <Phase3Celebration
            serviceName={state.service.service_name}
            city={state.profile.city}
            state={state.profile.state}
            userId={user?.id}
            onContinue={() => { track('next'); dispatch({ type: 'NEXT' }); }}
          />
        );
      case 'phase4_document':
        return (
          <Phase4Document
            data={state.profile}
            locked={!!coreLocks.document}
            onChange={patchProfile}
            saving={saving}
            userId={user?.id}
            onSkip={() => { track('skip'); dispatch({ type: 'NEXT' }); }}
            onContinue={async () => {
              track('submit');
              let ok = true;
              if (!coreLocks.document) {
                ok = await persistPatch({ tax_id: state.profile.document });
              }
              if (!ok) {
                return;
              }
              track('next');
              dispatch({ type: 'NEXT' });
            }}
          />
        );
      case 'phase4_avatar':
        return (
          <Phase4Avatar
            data={state.profile}
            onChange={patchProfile}
            saving={saving}
            userId={user?.id}
            onSkip={() => { track('skip'); dispatch({ type: 'NEXT' }); }}
            onBack={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase4_document' }); }}
            onContinue={async () => {
              track('submit');
              if (state.profile.avatar_url) {
                // Fase 1.6.4 — Canonical avatar write boundary.
                const { setUserAvatar } = await import('@/lib/avatarSync');
                const res = await setUserAvatar({
                  userId: user!.id,
                  url: state.profile.avatar_url,
                  source: 'onboarding_v2_shell',
                });
                if (!res.ok) return;
              }
              track('next');
              dispatch({ type: 'NEXT' });
            }}
          />
        );
      case 'phase4_extras_a':
        return (
          <Phase4ExtrasA
            data={state.profile}
            onChange={patchProfile}
            saving={saving}
            onSkip={() => { track('skip'); dispatch({ type: 'NEXT' }); }}
            onContinue={async () => {
              track('submit');
              const ok = await persistPatch(nullifyEmpty({
                years_experience: state.profile.years_experience,
                neighborhood: state.profile.neighborhood,
                description: state.profile.bio,
              }));
              if (!ok) return;
              track('next');
              dispatch({ type: 'NEXT' });
            }}
          />
        );
      case 'phase4_extras_b':
        return (
          <Phase4ExtrasB
            data={state.profile}
            onChange={patchProfile}
            saving={saving}
            onSkip={async () => {
              track('skip');
              void import('@/lib/registrationSnapshot').then(({ recordRegistrationSnapshotOnce }) =>
                recordRegistrationSnapshotOnce({
                  whatsapp: state.profile.whatsapp,
                  postal_code: state.profile.postal_code,
                  street: state.profile.street,
                  street_number: state.profile.street_number,
                  neighborhood: state.profile.neighborhood,
                  city: state.profile.city,
                  state: state.profile.state,
                  latitude: (state.profile as any).latitude ?? null,
                  longitude: (state.profile as any).longitude ?? null,
                  accuracy_m: (state.profile as any).accuracy_m ?? readAccuracyMeters(),
                  velocity_mps: (state.profile as any).velocity_mps ?? readVelocityMps(),
                  terms_accepted: true,
                  terms_version: TERMS_VERSION,
                  origin_summary: {
                    flow: 'onboarding_v2',
                    account_type: state.profile.kind,
                    has_first_service: !!state.service.service_name,
                    finished_via: 'skip',
                  },
                }),
              );
              dispatch({ type: 'NEXT' });
            }}
            onBack={() => { track('back'); dispatch({ type: 'GO_TO', phase: 'phase4_extras_a' }); }}
            onFinish={async () => {
              track('submit');
              const ok = await persistPatch(nullifyEmpty({
                instagram_url: state.profile.instagram_url,
                facebook_url: state.profile.facebook_url,
                website: state.profile.website_url,
              }));
              if (!ok) return;
              void import('@/lib/registrationSnapshot').then(({ recordRegistrationSnapshotOnce }) =>
                recordRegistrationSnapshotOnce({
                  whatsapp: state.profile.whatsapp,
                  postal_code: state.profile.postal_code,
                  street: state.profile.street,
                  street_number: state.profile.street_number,
                  neighborhood: state.profile.neighborhood,
                  city: state.profile.city,
                  state: state.profile.state,
                  latitude: (state.profile as any).latitude ?? null,
                  longitude: (state.profile as any).longitude ?? null,
                  accuracy_m: (state.profile as any).accuracy_m ?? readAccuracyMeters(),
                  velocity_mps: (state.profile as any).velocity_mps ?? readVelocityMps(),
                  terms_accepted: true, // clique Finalizar = aceite explícito dos Termos
                  terms_version: TERMS_VERSION,
                  origin_summary: {
                    flow: 'onboarding_v2',
                    account_type: state.profile.kind,
                    has_first_service: !!state.service.service_name,
                    finished_via: 'finish',
                  },
                }),
              );
              track('next');
              dispatch({ type: 'NEXT' });
            }}
          />
        );
      case 'done':
        return null;
    }
  };

  // Progresso: a celebração já é "100%" sensorial, então tudo a partir dela conta como completo.
  // A barra de progresso GLOBAL agora vive no WizardShell. Mantemos apenas
  // o cálculo interno por compat (testes), mas não renderizamos mais a barra
  // local — evita duplicidade visual quando aberto via /cadastro-inicial.
  const isCelebrationOrLater =
    state.phase === 'phase3_celebration' ||
    state.phase === 'phase4_document' ||
    state.phase === 'phase4_extras_a' ||
    state.phase === 'phase4_extras_b' ||
    state.phase === 'done';
  void isCelebrationOrLater;

  return (
    <>
      {/* Aviso "rascunho restaurado" — diferencia local x remoto */}
      <AnimatePresence>
        {draftRestored && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto mt-3 flex max-w-md items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-foreground"
          >
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-accent shrink-0" />
            <div className="space-y-0.5">
              {draftRestored.source === 'remote' ? (
                <>
                  <p className="font-semibold">Rascunho de outro dispositivo restaurado.</p>
                  <p className="text-muted-foreground">
                    Trouxemos seus dados salvos
                    {draftRestored.at && (
                      <> em {new Date(draftRestored.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</>
                    )}.
                  </p>
                </>
              ) : (
                <p>Continuamos de onde você parou neste dispositivo.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BetCardShell animated={false}>
        {state.phase !== 'phase2_service' && state.phase !== 'done' && (
          <div className="mb-2 flex items-center justify-end">
            <AutoSaveBadge signal={state.profile} />
          </div>
        )}
{/* Faixa "Já preenchido" removida — vazava nomes técnicos (full_name, document)
            ao usuário final. Os locks continuam ativos via `coreLocks`/`pendingCoreFields`
            para a lógica interna, mas sem renderização. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={state.phase}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {renderPhase()}
          </motion.div>
        </AnimatePresence>
      </BetCardShell>

      <RemoteDraftRecoveryModal
        open={showRemoteModal}
        payload={remoteDraft?.payload || null}
        phase={(remoteDraft?.phase as any) || null}
        updatedAt={remoteDraft?.updated_at || null}
        onContinue={handleRemoteContinue}
        onDiscard={handleRemoteDiscard}
      />

      <WizardErrorModal
        open={!!errorModal}
        onOpenChange={(v) => { if (!v) setErrorModal(null); }}
        code={errorModal?.code || ''}
        step={String(state.phase)}
        missingFields={errorModal?.missingFields}
        technicalMessage={errorModal?.techMessage ?? null}
        technicalCode={errorModal?.techCode ?? null}
        contextSnapshot={{
          category: (state.service?.category_ids?.[0]) || null,
          city: state.profile?.city || null,
          state_uf: state.profile?.state || null,
          lastPersistError: lastPersistError
            ? { message: lastPersistError.message, code: lastPersistError.code || null }
            : null,
        }}
        onRetry={() => errorModal?.onRetry?.()}
        onBack={() => {
          void import('@/lib/wizardBackNav').then(({ requestWizardBackForPhase }) => {
            requestWizardBackForPhase({
              phase: state.phase,
              source: 'error_modal',
              editMode,
              meta: { code: errorModal?.code || null },
            });
          });
        }}
      />
    </>
  );
};

export default OnboardingV2Shell;
