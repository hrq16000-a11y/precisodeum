// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Barrel
// Pure, deterministic, read-only. No side effects on import.

import type {
  RuntimeMetaEnvelope,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';
import { aggregateMetaTransformations } from './metaAggregation';

export * from './metaTransformationTypes';
export * from './metaTransformation';
export * from './metaComposition';
export * from './metaIdentity';
export * from './metaNormalization';
export * from './metaDeterminism';
export * from './metaEquivalence';
export * from './metaTopology';
export * from './metaStability';
export * from './metaCertification';
export * from './metaAdapters';
export * from './metaObservability';
export * from './metaExplainers';
export * from './metaGuards';
export * from './metaAggregation';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

/**
 * Build a fully-integrated, deterministic, read-only envelope for a single
 * meta-transformation. Reuses the canonical aggregation pipeline so that
 * topology/stability/certification/determinism/equivalence stay byte-equivalent
 * across all call sites.
 */
export function buildMetaTransformationEnvelope(
  t: RuntimeMetaTransformation,
): RuntimeMetaEnvelope {
  const agg = aggregateMetaTransformations([t]);
  const env = agg.envelopes[0];
  return deepFreeze(env);
}

export const __runtime_meta_transformation_calculus_internals = deepFreeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
  phase: '1.9.10',
  sealed: true,
});
