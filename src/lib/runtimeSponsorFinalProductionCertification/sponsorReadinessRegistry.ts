/**
 * Readiness Registry — registro determinístico de readiness por dimensão.
 */
import { certifyProductionReadiness } from './sponsorProductionReadinessRuntime';

export interface ReadinessRegistryEntry {
  readonly dimension: string;
  readonly ready: boolean;
}

export function buildReadinessRegistry(): readonly ReadinessRegistryEntry[] {
  return Object.freeze(
    certifyProductionReadiness().dimensions.map((d) =>
      Object.freeze({ dimension: d.dimension, ready: d.ready }),
    ),
  );
}
