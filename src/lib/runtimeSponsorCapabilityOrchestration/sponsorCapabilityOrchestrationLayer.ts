/**
 * Phase 1.9.24 — Sponsor Capability Orchestration Layer.
 * Top-level orchestrator for the deterministic capability plane.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorCapabilityDeterminismError } from './sponsorCapabilityInternals';
import {
  buildCapabilityRegistry,
  resolveCapabilities,
  type SponsorCapabilityRegistry,
} from './sponsorCapabilityRegistry';
import {
  resolveEntitlementMatrix,
  type SponsorEntitlementMatrix,
} from './sponsorEntitlementMatrix';
import {
  validateCapabilityCompatibility,
  type SponsorCapabilityCompatibilityGraph,
} from './sponsorCapabilityCompatibility';
import {
  computeCapabilityLineage,
  type SponsorCapabilityLineage,
} from './sponsorCapabilityLineage';
import {
  generateCapabilitySnapshot,
  type SponsorCapabilitySnapshot,
} from './sponsorCapabilitySnapshot';
import {
  buildCapabilityEnvelope,
  lockCapabilityEnvelope,
  type SponsorDeterministicCapabilityEnvelope,
} from './sponsorDeterministicCapabilityEnvelope';
import type { SponsorCapabilityDefinitionInput } from './sponsorCapabilityDefinitions';

export interface SponsorCapabilityOrchestrationResult {
  readonly registry: SponsorCapabilityRegistry;
  readonly matrix: SponsorEntitlementMatrix;
  readonly graph: SponsorCapabilityCompatibilityGraph;
  readonly lineage: SponsorCapabilityLineage;
  readonly snapshot: SponsorCapabilitySnapshot;
  readonly envelope: SponsorDeterministicCapabilityEnvelope;
}

export function runCapabilityOrchestrationLayer(
  inputs: ReadonlyArray<SponsorCapabilityDefinitionInput>,
): SponsorCapabilityOrchestrationResult {
  const registry = buildCapabilityRegistry(inputs);
  const matrix = resolveEntitlementMatrix(registry);
  const graph = validateCapabilityCompatibility(registry);
  const lineage = computeCapabilityLineage(registry);
  const snapshot = generateCapabilitySnapshot(registry, matrix, graph, lineage);
  const envelope = buildCapabilityEnvelope(registry, matrix, graph, lineage, snapshot);
  lockCapabilityEnvelope(envelope);
  return Object.freeze({ registry, matrix, graph, lineage, snapshot, envelope });
}

export function assertCapabilityDeterminism(
  a: SponsorDeterministicCapabilityEnvelope,
  b: SponsorDeterministicCapabilityEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorCapabilityDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorCapabilityDeterminismError('snapshot signature drift');
  }
  if (a.registry.registrySignature !== b.registry.registrySignature) {
    throw new SponsorCapabilityDeterminismError('registry signature drift');
  }
  if (a.matrix.matrixSignature !== b.matrix.matrixSignature) {
    throw new SponsorCapabilityDeterminismError('matrix signature drift');
  }
  if (a.graph.graphSignature !== b.graph.graphSignature) {
    throw new SponsorCapabilityDeterminismError('graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorCapabilityDeterminismError('lineage signature drift');
  }
}

export { buildCapabilityRegistry, resolveCapabilities };
