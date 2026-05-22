/**
 * Rollout Exposure Coordinator — coordena exposição staged determinística.
 */
import {
  coordinateExposureProgression,
  type RolloutStageOutcome,
} from './sponsorRolloutOrchestrationRuntime';

export interface ExposurePlan {
  readonly steps: readonly RolloutStageOutcome[];
  readonly maxExposurePct: number;
  readonly realExposureAllowed: false;
}

export function buildExposurePlan(): ExposurePlan {
  const steps = coordinateExposureProgression();
  const max = steps.reduce((acc, s) => (s.exposurePct > acc ? s.exposurePct : acc), 0);
  return Object.freeze({
    steps,
    maxExposurePct: max,
    realExposureAllowed: false,
  });
}
