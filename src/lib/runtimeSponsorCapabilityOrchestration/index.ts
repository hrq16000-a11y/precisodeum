/**
 * Phase 1.9.24 — Sponsor Capability Orchestration & Feature Entitlement Layer.
 * Read-only capability plane over phases 1.9.14 → 1.9.23.
 */
export * from './sponsorCapabilityDefinitions';
export * from './sponsorCapabilityRegistry';
export * from './sponsorEntitlementMatrix';
export * from './sponsorCapabilityCompatibility';
export * from './sponsorCapabilityLineage';
export * from './sponsorCapabilitySnapshot';
export * from './sponsorDeterministicCapabilityEnvelope';
export * from './sponsorCapabilityOrchestrationLayer';
export {
  SPONSOR_CAPABILITY_INTERNALS,
  SponsorCapabilityMutationError,
  SponsorCapabilityCompatibilityError,
  SponsorCapabilityDeterminismError,
} from './sponsorCapabilityInternals';
