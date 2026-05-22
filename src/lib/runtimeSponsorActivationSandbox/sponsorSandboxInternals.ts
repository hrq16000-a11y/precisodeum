/**
 * Phase 1.9.47 — Sponsor Runtime Activation Sandbox (internals).
 * 100% read-only, deterministic, simulation-only. No real IO.
 */
export const SPONSOR_SANDBOX_INTERNALS = Object.freeze({
  stage: 'STAGE_0_READ_ONLY' as const,
  sandboxMode: 'DETERMINISTIC_DRY_RUN_ONLY' as const,
  upstreamMutationAllowed: false,
  realNetworkingAllowed: false,
  realPersistenceAllowed: false,
  realBillingAllowed: false,
  realSchedulingAllowed: false,
  realRetriesAllowed: false,
  realWorkersAllowed: false,
  realMonetizationAllowed: false,
  postLockMutationAllowed: false,
});

export const SANDBOX_UPSTREAM_LAYERS = Object.freeze([
  '1.9.14', '1.9.15', '1.9.16', '1.9.17', '1.9.18', '1.9.19', '1.9.20',
  '1.9.21', '1.9.22', '1.9.23', '1.9.24', '1.9.25', '1.9.26', '1.9.27',
  '1.9.28', '1.9.29', '1.9.30', '1.9.31', '1.9.32', '1.9.33', '1.9.34',
  '1.9.35', '1.9.36', '1.9.37', '1.9.38', '1.9.39', '1.9.40', '1.9.41',
  '1.9.42', '1.9.43', '1.9.44', '1.9.45', '1.9.46',
] as const);

export type SponsorSandboxUpstreamLayer = typeof SANDBOX_UPSTREAM_LAYERS[number];

export const SANDBOX_ROLLOUT_STAGES = Object.freeze([
  'dark_launch',
  'internal_only',
  'canary_1pct',
  'canary_5pct',
  'beta_25pct',
  'beta_50pct',
  'general_availability',
] as const);

export type SponsorSandboxRolloutStage = typeof SANDBOX_ROLLOUT_STAGES[number];
