/**
 * Phase 1.9.21 — Sponsor Distributed Consistency Orchestrator.
 *
 * Sits ABOVE the 1.9.20 stabilized API surface. Consumes pre-built edge
 * envelopes from multiple simulated nodes and asserts global deterministic
 * equivalence. Read-only. Stateless. Never mutates any payload, never
 * recomputes any decision, never touches the contract.
 */
import type { SponsorEdgeConsistencyEnvelope } from '@/lib/runtimeSponsorProductSurfaceStabilization';
import {
  createConsistencyOrchestrationContext,
  type SponsorConsistencyOrchestrationContext,
  type SponsorGlobalConsistencyNode,
} from './sponsorConsistencyOrchestrationContext';
import {
  computeNodeEquivalenceMatrix,
  type SponsorCrossNodeEquivalenceResult,
} from './sponsorCrossNodeEquivalence';
import {
  detectDeterministicDrift,
  assertNoDeterministicDrift,
  type SponsorDeterminismDriftReport,
} from './sponsorDeterminismDriftDetector';
import {
  reconcileExecutionFrames,
  type SponsorNodeReconciliationVector,
} from './sponsorNodeReconciliationEngine';
import {
  buildGlobalConsistencyEnvelope,
  type SponsorGlobalDeterminismEnvelope,
} from './sponsorGlobalConsistencyEnvelope';
import {
  SPONSOR_CONSISTENCY_INTERNALS,
  SponsorConsistencyDriftError,
} from './sponsorConsistencyInternals';

export interface SponsorOrchestrationInput {
  readonly orchestrationId: string;
  readonly entries: ReadonlyArray<{
    readonly node: SponsorGlobalConsistencyNode;
    readonly envelope: SponsorEdgeConsistencyEnvelope;
  }>;
}

export class SponsorDistributedConsistencyOrchestrator {
  get internals() {
    return SPONSOR_CONSISTENCY_INTERNALS;
  }

  /** Build a deterministic, ordering-stable orchestration context. */
  buildContext(input: SponsorOrchestrationInput): SponsorConsistencyOrchestrationContext {
    if (!input.orchestrationId) {
      throw new Error('[sponsor-consistency] orchestrationId is required');
    }
    if (!input.entries || input.entries.length === 0) {
      throw new Error('[sponsor-consistency] at least one node envelope is required');
    }
    return createConsistencyOrchestrationContext(input.orchestrationId, input.entries);
  }

  computeNodeEquivalenceMatrix(
    ctx: SponsorConsistencyOrchestrationContext,
  ): SponsorCrossNodeEquivalenceResult {
    return computeNodeEquivalenceMatrix(ctx);
  }

  detectDeterministicDrift(
    equivalence: SponsorCrossNodeEquivalenceResult,
  ): SponsorDeterminismDriftReport {
    return detectDeterministicDrift(equivalence);
  }

  reconcileExecutionFrames(
    ctx: SponsorConsistencyOrchestrationContext,
  ): SponsorNodeReconciliationVector {
    return reconcileExecutionFrames(ctx);
  }

  validateCrossNodeParity(ctx: SponsorConsistencyOrchestrationContext): void {
    assertNoDeterministicDrift(computeNodeEquivalenceMatrix(ctx));
  }

  /** Full pipeline: equivalence → drift assertion → reconciliation → envelope. */
  buildGlobalConsistencyEnvelope(
    ctx: SponsorConsistencyOrchestrationContext,
  ): SponsorGlobalDeterminismEnvelope {
    const equivalence = computeNodeEquivalenceMatrix(ctx);
    assertNoDeterministicDrift(equivalence);
    const reconciliation = reconcileExecutionFrames(ctx);
    return buildGlobalConsistencyEnvelope(ctx, equivalence, reconciliation);
  }

  /** Fail-closed assertion of global determinism for a built envelope. */
  assertGlobalDeterministicEquivalence(env: SponsorGlobalDeterminismEnvelope): void {
    if (!env.locked) {
      throw new SponsorConsistencyDriftError('global envelope not locked');
    }
    if (!Object.isFrozen(env)) {
      throw new SponsorConsistencyDriftError('global envelope not frozen');
    }
    if (!env.equivalence.equivalent || env.equivalence.divergences.length > 0) {
      throw new SponsorConsistencyDriftError('global envelope reports divergence');
    }
    if (
      env.reconciliation.canonicalFingerprint !== env.equivalence.referenceFingerprint ||
      env.reconciliation.canonicalStabilityToken !== env.equivalence.referenceStabilityToken ||
      env.reconciliation.canonicalIdempotencyDigest !== env.equivalence.referenceIdempotencyDigest
    ) {
      throw new SponsorConsistencyDriftError('reconciliation vector inconsistent with equivalence');
    }
  }
}
