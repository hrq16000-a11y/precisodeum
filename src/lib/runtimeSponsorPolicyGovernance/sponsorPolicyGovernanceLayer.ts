/**
 * Phase 1.9.23 — Sponsor Policy Governance Layer.
 * Top-level orchestrator for the deterministic control plane.
 * READ-ONLY · DETERMINISTIC · ZERO RECOMPUTATION · ZERO UPSTREAM MUTATION.
 */
import {
  SponsorPolicyDeterminismError,
} from './sponsorPolicyInternals';
import {
  buildPolicyRegistry,
  resolveGovernanceRules,
  type SponsorPolicyRegistry,
} from './sponsorPolicyRegistry';
import {
  validatePolicyCompatibility,
  type SponsorPolicyCompatibilityMatrix,
} from './sponsorPolicyCompatibility';
import { computeRuleLineage, type SponsorRuleLineage } from './sponsorRuleLineage';
import {
  generateGovernanceSnapshot,
  type SponsorGovernanceSnapshot,
} from './sponsorGovernanceSnapshot';
import {
  buildPolicyEnvelope,
  lockPolicyEnvelope,
  type SponsorDeterministicPolicyEnvelope,
} from './sponsorDeterministicPolicyEnvelope';
import type { SponsorGovernanceRuleInput } from './sponsorGovernanceRules';

export interface SponsorPolicyGovernanceResult {
  readonly registry: SponsorPolicyRegistry;
  readonly matrix: SponsorPolicyCompatibilityMatrix;
  readonly lineage: SponsorRuleLineage;
  readonly snapshot: SponsorGovernanceSnapshot;
  readonly envelope: SponsorDeterministicPolicyEnvelope;
}

export function runPolicyGovernanceLayer(
  inputs: ReadonlyArray<SponsorGovernanceRuleInput>,
): SponsorPolicyGovernanceResult {
  const registry = buildPolicyRegistry(inputs);
  const matrix = validatePolicyCompatibility(registry);
  const lineage = computeRuleLineage(registry);
  const snapshot = generateGovernanceSnapshot(registry, matrix, lineage);
  const envelope = buildPolicyEnvelope(registry, matrix, lineage, snapshot);
  lockPolicyEnvelope(envelope);
  return Object.freeze({ registry, matrix, lineage, snapshot, envelope });
}

export function assertPolicyDeterminism(
  a: SponsorDeterministicPolicyEnvelope,
  b: SponsorDeterministicPolicyEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorPolicyDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorPolicyDeterminismError('snapshot signature drift');
  }
  if (a.registry.registrySignature !== b.registry.registrySignature) {
    throw new SponsorPolicyDeterminismError('registry signature drift');
  }
}

export { buildPolicyRegistry, resolveGovernanceRules };
