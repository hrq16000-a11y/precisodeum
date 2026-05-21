/**
 * Phase 1.9.21 — Sponsor Distributed Consistency & Multi-Edge Orchestration Layer.
 * Read-only global parity enforcement over the 1.9.20 stabilized API surface.
 */
export * from './sponsorConsistencyOrchestrationContext';
export * from './sponsorCrossNodeEquivalence';
export * from './sponsorDeterminismDriftDetector';
export * from './sponsorNodeReconciliationEngine';
export * from './sponsorGlobalConsistencyEnvelope';
export * from './sponsorDistributedConsistencyOrchestrator';
export {
  SPONSOR_CONSISTENCY_INTERNALS,
  SponsorConsistencyDriftError,
} from './sponsorConsistencyInternals';
