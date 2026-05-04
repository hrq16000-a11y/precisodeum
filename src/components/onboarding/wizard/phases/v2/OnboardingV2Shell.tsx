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
import { normalizeProviderPayload, detectForbiddenAddressKeys } from '@/lib/providerPayload';
import { logWizardError } from '@/lib/wizardErrorGuard';
import { registerBackOwner, claimBackEvent } from '@/lib/wizardBackOrchestrator';
import { markOnboardingCompletionGrace } from '@/lib/onboardingAccess';
import { finalizeOnboarding } from '@/lib/finalizeOnboarding';
import { setActiveWizardPhase, scheduleWizardTimeout } from '@/lib/wizardZombieGuard';
import { parseProviderIntegrityError, dispatchProviderIntegrityFocus } from '@/lib/providerIntegrityError';

// Aviso única vez por sessão para evitar spam
let _addressWarnedOnce = false;
function warnIfForbiddenAddress(payload: Record<string, unknown>) {
  const found = detectForbiddenAddressKeys(payload);
  if (found.length > 0 && !_addressWarnedOnce) {
    _addressWarnedOnce = true;
    toast.warning('Campos de endereço ignorados', {
      description: `Os campos ${found.join(', ')} não são salvos — usamos só cidade, estado e bairro. Seu cadastro foi salvo normalmente.`,
      duration: 6000,
    });
  }
}

function parseServiceAreaToCities(value: string | null | undefined): string[] {
  return String(value || '')
    .split(/[;|•\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseStartingPrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(String(value).replace(/[^\d,.]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildProviderSocialPatch(patch: Record<string, any>, currentProfile: { instagram_url?: string; facebook_url?: string; website_url?: string }) {
  const nextPatch = { ...patch };
  const hasSocialKeys = 'instagram_url' in nextPatch || 'facebook_url' in nextPatch || 'website' in nextPatch || 'website_url' in nextPatch;
  if (!hasSocialKeys) return nextPatch;

  const socialLinks = {
    instagram: nextPatch.instagram_url ?? currentProfile.instagram_url ?? null,
    facebook: nextPatch.facebook_url ?? currentProfile.facebook_url ?? null,
  };

  delete nextPatch.instagram_url;
  delete nextPatch.facebook_url;

  if ('website_url' in nextPatch && !('website' in nextPatch)) {
    nextPatch.website = nextPatch.website_url;
  }
  delete nextPatch.website_url;

  nextPatch.social_links = socialLinks;
  return nextPatch;
}

function withProviderLocationFallback(
  patch: Record<string, any>,
  profile: {
    city?: string;
    state?: string;
    neighborhood?: string;
    latitude?: number | null;
    longitude?: number | null;
  },
) {
  const next = { ...patch };
  if (!('city' in next) || typeof next.city !== 'string' || !next.city.trim()) {
    next.city = profile.city || '';
  }
  if (!('state' in next) || typeof next.state !== 'string' || !next.state.trim()) {
    next.state = profile.state || '';
  }
  if (!('neighborhood' in next) || typeof next.neighborhood !== 'string' || !next.neighborhood.trim()) {
    next.neighborhood = profile.neighborhood || '';
  }
  if ((next.latitude == null || next.longitude == null) && profile.latitude != null && profile.longitude != null) {
    next.latitude = profile.latitude;
    next.longitude = profile.longitude;
  }
  return next;
}
import { useWizardDuplicateCheck } from '@/hooks/useWizardDuplicateCheck';
import {
  initialOnboardingState,
  onboardingReducer,
  phaseIndex,
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
import { pushReviewPhase, popReviewPhase, clearReviewHistory } from './reviewHistory';
import {
  useOnboardingV2Draft,
  readOnboardingV2Draft,
  clearOnboardingV2Draft,
} from './useOnboardingV2Draft';
import { flushOnboardingV2Draft, flushLocalDraft } from './flushDraft';
import { findExistingFirstService, findExistingProvider, fetchExistingFirstService } from './findExistingRecords';
import {
  useOnboardingV2RemoteDraft,
  fetchRemoteDraft,
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

function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}


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
  // Timer rastreado do hint "rascunho restaurado" (caminho remoto, fora de useEffect).
  // Mantido em ref para garantir cleanup no unmount e evitar setState zumbi.
  const remoteDraftHintTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (remoteDraftHintTimer.current) window.clearTimeout(remoteDraftHintTimer.current);
  }, []);
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

  // Flush imediato (local + remoto) ao TROCAR DE FASE — garante que
  // "Salvar e continuar" persista antes de qualquer fechamento de aba,
  // sem esperar pelos debounces de 600ms / 1500ms.
  // BLINDAGEM: pulamos o flush em editMode — evita gravar payload parcial
  // (provisório, durante revisão) por cima dos dados reais já publicados.
  useEffect(() => {
    if (editMode) return;
    if (state.phase === 'phase2_service' || state.phase === 'done') return;
    flushOnboardingV2Draft(state, user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, user?.id, editMode]);

  // Flush ao desmontar / antes de fechar a aba
  useEffect(() => {
    const onBeforeUnload = () => {
      try { flushLocalDraft(state); } catch { /* noop */ }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state]);

  // Aviso de "rascunho restaurado" do LOCAL (mesmo dispositivo)
  useEffect(() => {
    if (skipDraftRestore) {
      // Quando entramos via handoff da triagem, marcamos a fonte como "seed".
      if (!getOnboardingDraftSource()) setOnboardingDraftSource('seed');
      return;
    }
    const draft = readOnboardingV2Draft();
    if (draft && draft.phase && draft.phase !== 'phase2_service') {
      setDraftRestored({ source: 'local' });
      setOnboardingDraftSource('local');
      const t = scheduleWizardTimeout(
        { phase: state.phase as any, action: 'shell_local_draft_hint_clear' },
        () => setDraftRestored(null),
        5000,
      );
      return () => clearTimeout(t);
    }
    // Sessão limpa: marca explicitamente como "none" para diferenciar de
    // sessões antigas onde a chave estava ausente.
    if (!getOnboardingDraftSource()) setOnboardingDraftSource('none');
  }, [skipDraftRestore]);

  // Detecta rascunho REMOTO (troca de dispositivo) e ABRE MODAL para o usuário decidir.
  // Não auto-hidrata mais — evita "salto" silencioso de etapa.
  // G5: comparação inteligente — se o rascunho remoto está numa fase MAIS AVANÇADA
  // que a local, ainda assim oferecemos a recuperação (caso contrário o usuário
  // poderia repetir etapas já concluídas em outro dispositivo).
  useEffect(() => {
    if (!user?.id) return;
    if (skipDraftRestore) return;
    const local = readOnboardingV2Draft();
    const localPhase = (local?.phase as any) || 'phase2_service';
    let alive = true;
    (async () => {
      const remote = await fetchRemoteDraft(user.id);
      if (!alive || !remote) return;
      const remotePhase = remote.phase as any;
      const remoteIdx = phaseIndex(remotePhase);
      const localIdx = phaseIndex(localPhase);
      const remoteIsAhead = remoteIdx > localIdx;
      const localIsEmpty = !local || localPhase === 'phase2_service';
      // Pergunta sempre que (a) local vazio, ou (b) remoto está mais à frente.
      if (!localIsEmpty && !remoteIsAhead) return;
      setRemoteDraft(remote);
      setShowRemoteModal(true);
    })();
    return () => { alive = false; };
  }, [user?.id, skipDraftRestore]);

  const handleRemoteContinue = () => {
    if (remoteDraft) {
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
      setDraftRestored({ source: 'remote', at: remoteDraft.updated_at });
      setOnboardingDraftSource('remote');
      if (remoteDraftHintTimer.current) window.clearTimeout(remoteDraftHintTimer.current);
      remoteDraftHintTimer.current = scheduleWizardTimeout(
        { phase: state.phase as any, action: 'shell_remote_draft_hint_clear' },
        () => setDraftRestored(null),
        6000,
      );
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

  // Bootstrap do fluxo único: se o V3 já coletou nome/WhatsApp/cidade,
  // o V2 deve entrar direto na criação do primeiro serviço sem repetir perguntas.
  useEffect(() => {
    const bootstrap = buildOnboardingV2BootstrapState({ profile, provider });
    if (!bootstrap) return;

    const draftSnapshot = {
      phase: state.phase,
      providerId: state.providerId,
      firstServiceId: state.firstServiceId,
      profile: state.profile,
      service: state.service,
    };
    const resolved = resolveOnboardingV2SeedState({
      draft: draftSnapshot,
      bootstrap,
      forceFromBootstrap: internalHandoffFromTriage,
    });

    const currentPhase = state.phase || 'phase2_service';
    const nextPhase = resolved.phase || currentPhase;
    const isRegression = phaseIndex(nextPhase) < phaseIndex(currentPhase);

    if (isRegression) {
      appendWizardResetDebugLog({
        source: 'onboarding-v2-phase-regression-blocked',
        route: `${location.pathname}${location.search}`,
        phase: currentPhase,
        nextRoute: null,
        reason: 'bootstrap-attempted-older-phase',
        meta: { currentPhase, nextPhase, internalHandoffFromTriage, pendingCoreFields },
      });
      return;
    }

    // Performance: evita HYDRATE redundante quando o `resolved` é
    // estruturalmente igual ao snapshot atual (caso comum quando refetchProfile
    // retorna o mesmo objeto e este efeito re-roda sem mudança real).
    const samePhase = (resolved.phase || currentPhase) === currentPhase;
    const sameProvider = (resolved.providerId ?? state.providerId ?? null) === (state.providerId ?? null);
    const sameService = (resolved.firstServiceId ?? state.firstServiceId ?? null) === (state.firstServiceId ?? null);
    const sameProfile = !resolved.profile || JSON.stringify({ ...state.profile, ...resolved.profile }) === JSON.stringify(state.profile);
    const sameServicePayload = !resolved.service || JSON.stringify({ ...state.service, ...resolved.service }) === JSON.stringify(state.service);
    if (samePhase && sameProvider && sameService && sameProfile && sameServicePayload) {
      return;
    }

    appendWizardResetDebugLog({
      source: 'onboarding-v2-bootstrap',
      route: `${location.pathname}${location.search}`,
      phase: nextPhase,
      nextRoute: null,
      reason: 'hydrate-from-profile-provider',
      meta: { internalHandoffFromTriage, pendingCoreFields, providerId: resolved.providerId ?? null },
    });

    dispatch({ type: 'HYDRATE', state: resolved });
  }, [profile, provider, internalHandoffFromTriage]);

  // ── HIDRATAÇÃO EM MODO REVISÃO ─────────────────────────────────────────────
  // Se o usuário já tem provider e/ou serviço cadastrado mas o estado local
  // está vazio (ex.: voltou ao Wizard depois de fechar o navegador, ou o draft
  // expirou), busca os dados reais no banco para que a UI mostre uma REVISÃO
  // do que existe — em vez de criar do zero e duplicar registros.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id && !state.userRef) return;

      // 1) Resgata providerId se ausente — tenta por user_id e por user_ref
      let pid = state.providerId;
      if (!pid) {
        pid = await findExistingProvider(user?.id ?? null, state.userRef ?? null);
        if (pid && !cancelled) {
          dispatch({ type: 'HYDRATE', state: { providerId: pid } });
        }
      }
      if (cancelled) return;

      // 2) Decide se precisamos buscar/rehidratar o serviço.
      //    Antes: pulávamos sempre que firstServiceId estava setado — isso
      //    deixava a UI vazia quando o draft remoto trazia só o ID, mas o
      //    corpo do serviço (categoria/descrição/etc.) tinha sido perdido.
      //    Agora rehidratamos se QUALQUER campo crítico estiver vazio.
      const svcState = state.service || ({} as any);
      // BLINDAGEM (auditoria 2026-05): "ter corpo" exige TEXTO REAL.
      // Antes aceitávamos apenas `category_ids`, mas o bootstrap injeta
      // `category_ids` a partir de `provider.primary_category_id` mesmo
      // quando o serviço real (services.service_name/description) está
      // ausente do estado — isso fazia o efeito curto-circuitar e a UI
      // ficava vazia em modo revisão.
      const hasServiceBody =
        !!(svcState.service_name && svcState.service_name.trim()) ||
        !!(svcState.description && svcState.description.trim());
      if (state.firstServiceId && hasServiceBody) return;

      // 3) Busca o melhor serviço existente (pelo provider OU pelo user_ref)
      //    para hidratar o Wizard em modo revisão sem duplicar registros.
      const svc = await fetchExistingFirstService(pid, state.userRef ?? null, state.profile.primary_category_id);
      if (!svc || cancelled) return;

      if (svc.id !== state.firstServiceId) {
        dispatch({ type: 'SET_FIRST_SERVICE_ID', id: svc.id });
      }

      const existingService = state.service || ({} as any);
        const merged: any = {
        service_name: existingService.service_name || svc.service_name || '',
        description: existingService.description || svc.description || '',
        category_ids:
          existingService.category_ids?.length
            ? existingService.category_ids
              : svc.category_id
                ? [svc.category_id]
                : [],
        cities_served:
          existingService.cities_served?.length
            ? existingService.cities_served
            : parseServiceAreaToCities(svc.service_area).length
              ? parseServiceAreaToCities(svc.service_area)
              : parseServiceAreaToCities(svc.address),
        starting_price_brl:
          existingService.starting_price_brl != null
            ? existingService.starting_price_brl
            : parseStartingPrice(svc.price),
        working_days: existingService.working_days || [],
        working_hours: existingService.working_hours || svc.working_hours || '',
        working_hours_struct: existingService.working_hours_struct ?? svc.working_hours_struct ?? null,
      };

      dispatch({ type: 'HYDRATE', state: { service: merged } });

      if (svc.category_id && !state.profile.primary_category_id) {
        dispatch({ type: 'PATCH_PROFILE', patch: { primary_category_id: svc.category_id } });
      }

      appendWizardResetDebugLog({
        source: 'onboarding-v2-hydrate-existing-service',
        route: `${location.pathname}${location.search}`,
        phase: state.phase,
        nextRoute: null,
        reason: 'review-mode-existing-records',
        meta: { providerId: pid, serviceId: svc.id },
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, state.userRef, state.providerId, state.firstServiceId]);

  // Telemetria: dispara 'enter' a cada troca de fase + mede tempo na fase anterior.
  // - Cada fase recebe `markPhaseEnter` no mount/troca.
  // - Ao trocar de fase (cleanup), `markPhaseExit` emite o evento `phase_exit`
  //   com `duration_ms` e `draft_source` (local/remote/seed/none).
  // - O evento `enter` também carrega `draft_source` para segmentação.
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
  useEffect(() => {
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

  useEffect(() => {
    if (state.phase !== 'done' || deferCompletionToParent) return;
    clearOnboardingV2Draft();
    const timer = scheduleWizardTimeout(
      { phase: 'done', action: 'shell_finish_wizard', runIfStale: true },
      () => { void finishWizard(); },
      300,
    );
    return () => window.clearTimeout(timer);
  }, [state.phase, deferCompletionToParent]);

  useEffect(() => {
    const goBack = async () => {
      // ── ANTI-AMNÉSIA: persiste o snapshot atual (local + remoto) ANTES
      // de despachar a troca de fase. Garante que qualquer dado digitado
      // ainda dentro do debounce do auto-save não se perca quando o
      // componente da fase atual desmontar.
      try {
        flushLocalDraft(state);
        if (!editMode) {
          // Em editMode evitamos overwrite remoto parcial (mesma blindagem
          // já aplicada no auto-save). Local é seguro.
          const { flushRemoteDraft } = await import('./flushDraft');
          await flushRemoteDraft(state, user?.id).catch(() => { /* fail-soft */ });
        }
      } catch { /* fail-soft */ }

      // ── MODO REVISÃO: navegação não-linear (Assistente é dono do Wizard) ─
      // 1) Tenta desempilhar fase REAL anterior visitada nesta sessão.
      // 2) Se a pilha esgota, delega ao WizardShell via evento global, que
      //    sabe retroceder linearmente pela UNIFIED_PHASE_ORDER (incluindo
      //    voltar de phase2_service para a triagem). Nunca cai no Dashboard
      //    abruptamente: o Voltar é "infinito" até a Step 1.
      if (editMode) {
        const previous = popReviewPhase();
        if (previous && previous !== state.phase) {
          dispatch({ type: 'GO_TO', phase: previous as any });
          return;
        }
        // Pilha esgotada — peça ao WizardShell para retroceder na régua unificada.
        try {
          window.dispatchEvent(new CustomEvent('wizard:request-prev-unified', {
            detail: { fromV2Phase: state.phase },
          }));
        } catch { /* fail-soft */ }
        return;
      }

      // ── FLUXO NORMAL (new_signup): mapa estático de antecessores ───────
      switch (state.phase) {
        // phase1_* removidas em mai/2026; phase2_service é a 1ª fase viva do V2.
        // Voltar de phase2_service é responsabilidade do WizardShell (sai para triage_celebration).
        case 'phase2_service':
          /* noop — WizardShell trata o retorno à triagem */
          break;
        case 'phase2_details':
          dispatch({ type: 'GO_TO', phase: 'phase2_service' });
          break;
        case 'phase2_photos':
          dispatch({ type: 'GO_TO', phase: 'phase2_details' });
          break;
        case 'phase3_celebration':
          dispatch({ type: 'GO_TO', phase: 'phase2_photos' });
          break;
        case 'phase4_document':
          dispatch({ type: 'GO_TO', phase: 'phase3_celebration' });
          break;
        case 'phase4_avatar':
          dispatch({ type: 'GO_TO', phase: 'phase4_document' });
          break;
        case 'phase4_extras_a':
          dispatch({ type: 'GO_TO', phase: 'phase4_avatar' });
          break;
        case 'phase4_extras_b':
          dispatch({ type: 'GO_TO', phase: 'phase4_extras_a' });
          break;
      }
    };
    const handler = (e: Event) => { void goBack(); };
    window.addEventListener('wizard:request-back', handler as EventListener);
    return () => window.removeEventListener('wizard:request-back', handler as EventListener);
  }, [state, editMode, navigate, user?.id]);

  // Limpeza do histórico de revisão ao SAIR do modo edit_profile (ex.: usuário
  // volta para new_signup na mesma aba). Garante que pilha velha não vaze
  // para uma próxima sessão de revisão.
  useEffect(() => {
    if (!editMode) clearReviewHistory();
  }, [editMode]);

  /* ───── Persistência: cria/atualiza provider ao fim da Fase 1 ───── */
  const persistPhase1 = async () => {
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

  /* ───── Persistência: cria 1º serviço (Fase 2) ───── */
  const persistFirstService = async (): Promise<boolean> => {
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
      if (resolvedServiceId) {
        // Estado local já tem ID → confiar e seguir para herança/conclusão.
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
            // Fallback defensivo: tenta UPDATE direto (mantém comportamento legado)
            await supabase
              .from('services')
              .update({ service_name: resolvedCategoryName, category_id: categoryId })
              .eq('id', reusedId);
          }
          resolvedServiceId = reusedId;
          dispatch({ type: 'SET_FIRST_SERVICE_ID', id: reusedId });
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

      // 2) Herança — categoria principal + horário sobem para o provider
      const updates: any = { category_id: categoryId };
      if (workingHoursSummary) updates.working_hours = workingHoursSummary;
      if (s.working_hours_struct) updates.working_hours_struct = s.working_hours_struct;
      if (s.starting_price_brl != null) updates.starting_price = s.starting_price_brl;
      await supabase.from('providers').update(updates).eq('id', workingProviderId);

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
      // Salva também tax_id no profile se vier
      if (incomingTaxId) {
        await supabase.from('profiles').update({ tax_id: incomingTaxId }).eq('id', user.id);
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
              onNext={() => { track('next'); dispatch({ type: 'NEXT' }); }}
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
                const ok = await persistPatch({ photo_url: state.profile.avatar_url });
                if (!ok) return;
                await supabase.from('profiles')
                  .update({ avatar_url: state.profile.avatar_url })
                  .eq('id', user!.id);
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
