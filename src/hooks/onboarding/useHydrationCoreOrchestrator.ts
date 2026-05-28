import { useEffect, type MutableRefObject } from 'react';
import {
  buildOnboardingV2BootstrapState,
  resolveOnboardingV2SeedState,
} from '@/components/onboarding/wizard/phases/v2/bootstrap';
import { phaseIndex } from '@/components/onboarding/wizard/phases/v2/state';
import {
  findExistingProvider,
  fetchExistingFirstService,
} from '@/components/onboarding/wizard/phases/v2/findExistingRecords';
import {
  parseServiceAreaToCities,
  parseStartingPrice,
} from '@/lib/onboarding/persistence/providerPatchHelpers';
import { appendWizardResetDebugLog } from '@/lib/wizardResetDebug';
import type {
  OnboardingState,
  OnboardingAction,
} from '@/components/onboarding/wizard/phases/v2/types';

type LifecyclePhase = 'BOOT' | 'HYDRATING' | 'HYDRATED' | 'READY' | 'SUBMITTING' | 'COMPLETED';

/**
 * Hydration Core (E14 + E15) — NÚCLEO ÚNICO COORDENADO.
 *
 * E14 e E15 vivem JUNTOS por contrato — bootstrap e replay são acoplados
 * semanticamente. NÃO separar em hooks independentes.
 *
 * HYDRATION-SEQUENCE (preservada byte-a-byte vs versão inline pré-extração):
 *   1. mount             → lifecyclePhaseRef = 'BOOT'
 *   2. RECOV (E8/E11)    → sticky draft source decidido upstream
 *   3. auth (E12/E13)    → full_name + userRef sincronizados upstream
 *   4. E14 (bootstrap)   → BOOT → HYDRATING → dispatch HYDRATE → HYDRATED
 *   5. E15 (replay/DB)   → async; HYDRATE restrito a campos faltantes.
 *                          NÃO recomputa seed. NÃO sobrescreve user input.
 *   6. E17/E16/E5        → consomem snapshot já hidratado.
 *
 * REPLAY ISOLATION:
 *   - merge respeita `existingService.* || svc.*`
 *   - só dispara quando providerId/firstServiceId/service body ausentes
 *   - sem write remoto (apenas dispatch local)
 *
 * LIFECYCLE permitido (sem novas fases):
 *   BOOT → HYDRATING → HYDRATED (idempotente; READY/SUBMITTING/COMPLETED owners externos).
 *
 * DEPS PRESERVADAS:
 *   - E14: [profile, provider, internalHandoffFromTriage]
 *   - E15: [user?.id, state.userRef, state.providerId, state.firstServiceId]
 */
export interface UseHydrationCoreOrchestratorParams {
  profile: any;
  provider: any;
  internalHandoffFromTriage: boolean | undefined;
  user: { id?: string } | null | undefined;
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
  signalLifecyclePhase: (next: LifecyclePhase) => void;
  lifecyclePhaseRef: MutableRefObject<LifecyclePhase>;
  pendingCoreFields: unknown;
  locationPath: string;
  locationSearch: string;
}

export function useHydrationCoreOrchestrator({
  profile,
  provider,
  internalHandoffFromTriage,
  user,
  state,
  dispatch,
  signalLifecyclePhase,
  lifecyclePhaseRef,
  pendingCoreFields,
  locationPath,
  locationSearch,
}: UseHydrationCoreOrchestratorParams): void {
  // ── E14 · BOOTSTRAP HYDRATE ────────────────────────────────────────────────
  useEffect(() => {
    if (lifecyclePhaseRef.current === 'BOOT') signalLifecyclePhase('HYDRATING');
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
        route: `${locationPath}${locationSearch}`,
        phase: currentPhase,
        nextRoute: null,
        reason: 'bootstrap-attempted-older-phase',
        meta: { currentPhase, nextPhase, internalHandoffFromTriage, pendingCoreFields },
      });
      return;
    }

    // Short-circuit estrutural (idêntico ao inline pré-extração).
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
      route: `${locationPath}${locationSearch}`,
      phase: nextPhase,
      nextRoute: null,
      reason: 'hydrate-from-profile-provider',
      meta: { internalHandoffFromTriage, pendingCoreFields, providerId: resolved.providerId ?? null },
    });

    dispatch({ type: 'HYDRATE', state: resolved });
    signalLifecyclePhase('HYDRATED');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, provider, internalHandoffFromTriage]);

  // ── E15 · REPLAY APPLICATION / revisão DB ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id && !state.userRef) return;

      // Replay stage 1 · providerId recovery
      let pid = state.providerId;
      if (!pid) {
        pid = await findExistingProvider(user?.id ?? null, state.userRef ?? null);
        if (pid && !cancelled) {
          dispatch({ type: 'HYDRATE', state: { providerId: pid } });
          signalLifecyclePhase('HYDRATED');
        }
      }
      if (cancelled) return;

      // Replay stage 2 · service body check
      const svcState = state.service || ({} as any);
      const hasServiceBody =
        !!(svcState.service_name && svcState.service_name.trim()) ||
        !!(svcState.description && svcState.description.trim());
      if (state.firstServiceId && hasServiceBody) return;

      // Replay stage 3 · fetch best existing service
      const svc = await fetchExistingFirstService(pid, state.userRef ?? null, state.profile.primary_category_id);
      if (!svc || cancelled) return;

      if (svc.id !== state.firstServiceId) {
        dispatch({ type: 'SET_FIRST_SERVICE_ID', id: svc.id });
      }

      // Replay stage 4 · merge respeitando user input (REPLAY ISOLATION).
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
      signalLifecyclePhase('HYDRATED');

      if (svc.category_id && !state.profile.primary_category_id) {
        dispatch({ type: 'PATCH_PROFILE', patch: { primary_category_id: svc.category_id } });
      }

      appendWizardResetDebugLog({
        source: 'onboarding-v2-hydrate-existing-service',
        route: `${locationPath}${locationSearch}`,
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
}
