/**
 * Operational Admissibility Resolver — resolve admissibilidade operacional.
 */
import { READINESS_DIMENSIONS, type ReadinessDimension } from './sponsorProductionReadinessRuntime';

export interface AdmissibilityResolution {
  readonly dimension: ReadinessDimension;
  readonly admissible: boolean;
  readonly realActivationAuthorized: false;
  readonly reason: string;
}

export function resolveOperationalAdmissibility(): readonly AdmissibilityResolution[] {
  return Object.freeze(
    READINESS_DIMENSIONS.map((d) =>
      Object.freeze({
        dimension: d,
        admissible: true,
        realActivationAuthorized: false as const,
        reason: 'ADMISSIBLE_FOR_FUTURE_CONTROLLED_ROLLOUT_ONLY',
      }),
    ),
  );
}
