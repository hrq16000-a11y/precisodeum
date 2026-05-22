/**
 * Rollout Admissibility Registry — registro de admissibilidade de rollout terminal.
 */
import { READINESS_DIMENSIONS } from './sponsorProductionReadinessRuntime';

export interface RolloutAdmissibilityEntry {
  readonly dimension: string;
  readonly admissibleForControlledRollout: true;
  readonly realRolloutAuthorized: false;
}

export function buildRolloutAdmissibilityRegistry(): readonly RolloutAdmissibilityEntry[] {
  return Object.freeze(
    READINESS_DIMENSIONS.map((d) =>
      Object.freeze({
        dimension: d,
        admissibleForControlledRollout: true as const,
        realRolloutAuthorized: false as const,
      }),
    ),
  );
}
