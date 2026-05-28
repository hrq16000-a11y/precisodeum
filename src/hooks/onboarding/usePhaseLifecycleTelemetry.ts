/**
 * usePhaseLifecycleTelemetry — emite os eventos `enter`/`complete` a cada
 * troca de fase + mede duração via `markPhaseEnter/markPhaseExit`.
 *
 * PR 17 — Shell Surface Slimming. Extração 1:1 do effect E16 do shell.
 *
 * ⚠️ POSITION-DEPENDENCY PRESERVADA:
 *   - E17 (`setActiveWizardPhase`) DEVE rodar antes (já está no shell).
 *   - Este hook substitui o effect E16 que vinha logo depois.
 *   - Mesma dep-array `[phase, userId]` — não rebinda em outras mudanças.
 *   - Mesma semântica de cleanup (emite `markPhaseExit` da fase que sai).
 *   - Mesmo evento (`'complete'` quando `phase === 'done'`, senão `'enter'`).
 *
 * Recebe o `trackEvent` injetado pelo shell (que carrega `meta.flow`) em
 * vez de chamar `trackOnboardingEvent` direto — preserva 100% o contrato
 * de dimensão de fluxo já estabilizado.
 */
import { useEffect } from 'react';
import {
  markPhaseEnter,
  markPhaseExit,
  getOnboardingDraftSource,
} from '@/components/onboarding/wizard/phases/v2/telemetry';
import type { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';

type TrackEvent = (args: Parameters<typeof trackOnboardingEvent>[0]) => Promise<any> | any;

interface PhaseLifecycleTelemetryInput {
  readonly phase: string;
  readonly userId?: string | null;
  readonly trackEvent: TrackEvent;
}

export function usePhaseLifecycleTelemetry({
  phase,
  userId,
  trackEvent,
}: PhaseLifecycleTelemetryInput): void {
  useEffect(() => {
    const draftSource = getOnboardingDraftSource() || 'none';
    void trackEvent({
      phase: phase as any,
      event: phase === 'done' ? 'complete' : 'enter',
      userId: userId ?? undefined,
      meta: { draft_source: draftSource },
    });
    markPhaseEnter(phase as any);

    const exitingPhase = phase;
    return () => {
      void markPhaseExit(exitingPhase as any, { userId: userId ?? undefined });
    };
    // Dep-array preservada: shell original usava [state.phase, user?.id].
    // `trackEvent` é estável (useCallback no shell) — adicioná-lo aqui faria
    // rebind ao mudar `isCompany`, alterando ordem de emissão. Manter como
    // está = zero runtime diff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, userId]);
}

export default usePhaseLifecycleTelemetry;
