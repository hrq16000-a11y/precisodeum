/**
 * Sponsor Rollout Internals — Fase 1.9.49
 * Configuração interna imutável do Controlled Rollout Orchestrator.
 */
export const SPONSOR_ROLLOUT_INTERNALS = Object.freeze({
  phase: '1.9.49',
  plane: 'CONTROLLED_ROLLOUT_ORCHESTRATOR',
  stage: 'STAGE_0_READ_ONLY',
  rolloutMode: 'DETERMINISTIC_SIMULATION_ONLY',
  realRolloutAllowed: false,
  realNetworkingAllowed: false,
  realPersistenceAllowed: false,
  realBillingAllowed: false,
  realSchedulingAllowed: false,
  realMonetizationAllowed: false,
  realFeatureExposureAllowed: false,
  upstreamMutationAllowed: false,
  failClosed: true,
  consumes: Object.freeze([
    '1.9.14', '1.9.15', '1.9.16', '1.9.17', '1.9.18', '1.9.19', '1.9.20',
    '1.9.21', '1.9.22', '1.9.23', '1.9.24', '1.9.25', '1.9.26', '1.9.27',
    '1.9.28', '1.9.29', '1.9.30', '1.9.31', '1.9.32', '1.9.33', '1.9.34',
    '1.9.35', '1.9.36', '1.9.37', '1.9.38', '1.9.39', '1.9.40', '1.9.41',
    '1.9.42', '1.9.43', '1.9.44', '1.9.45', '1.9.46', '1.9.47', '1.9.48',
  ]),
} as const);

export type SponsorRolloutInternals = typeof SPONSOR_ROLLOUT_INTERNALS;
