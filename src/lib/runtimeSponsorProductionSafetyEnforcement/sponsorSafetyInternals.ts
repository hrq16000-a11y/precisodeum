/**
 * Phase 1.9.48 — Sponsor Production Safety Enforcement Plane (internals).
 * Fail-closed, deterministic, read-only. No real IO, no upstream mutation.
 */
export const SPONSOR_SAFETY_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  enforcementMode: 'FAIL_CLOSED_DETERMINISTIC' as const,
  upstreamMutationAllowed: false,
  realNetworkingAllowed: false,
  realPersistenceAllowed: false,
  realBillingAllowed: false,
  realSchedulingAllowed: false,
  realRetriesAllowed: false,
  realWorkersAllowed: false,
  realMonetizationAllowed: false,
  postLockMutationAllowed: false,
  defaultDecision: 'BLOCK' as const,
});

export const SAFETY_UPSTREAM_LAYERS = Object.freeze([
  '1.9.14', '1.9.15', '1.9.16', '1.9.17', '1.9.18', '1.9.19', '1.9.20',
  '1.9.21', '1.9.22', '1.9.23', '1.9.24', '1.9.25', '1.9.26', '1.9.27',
  '1.9.28', '1.9.29', '1.9.30', '1.9.31', '1.9.32', '1.9.33', '1.9.34',
  '1.9.35', '1.9.36', '1.9.37', '1.9.38', '1.9.39', '1.9.40', '1.9.41',
  '1.9.42', '1.9.43', '1.9.44', '1.9.45', '1.9.46', '1.9.47',
] as const);

export type SponsorSafetyUpstreamLayer = typeof SAFETY_UPSTREAM_LAYERS[number];

export const SAFETY_BLOCKING_VECTORS = Object.freeze([
  'activation',
  'rollout',
  'execution',
  'exposure',
  'monetization',
  'persistence',
  'networking',
  'scheduling',
] as const);

export type SponsorSafetyBlockingVector = typeof SAFETY_BLOCKING_VECTORS[number];
