/**
 * Phase 1.9.25 — Sponsor System Topology Synthesis Layer.
 * Top-level orchestrator for the deterministic meta-system map.
 * READ-ONLY · DETERMINISTIC · ZERO FUNCTIONAL ACTIVATION · ZERO UPSTREAM MUTATION.
 */
import { SponsorTopologyDeterminismError } from './sponsorTopologyInternals';
import {
  buildSystemTopologyGraph,
  type SponsorSystemTopologyGraph,
  type SponsorTopologyLayerInput,
} from './sponsorSystemTopologyGraph';
import {
  resolveExecutionDependencies,
  type SponsorExecutionDependencyGraph,
} from './sponsorExecutionDependencyGraph';
import {
  computeTopologyLineage,
  type SponsorTopologyLineage,
} from './sponsorTopologyLineage';
import {
  generateTopologySnapshot,
  type SponsorTopologySnapshot,
} from './sponsorTopologySnapshot';
import {
  buildTopologyRegistry,
  type SponsorTopologyRegistry,
} from './sponsorTopologyRegistry';
import {
  buildTopologyEnvelope,
  lockTopologyEnvelope,
  type SponsorDeterministicTopologyEnvelope,
} from './sponsorDeterministicTopologyEnvelope';

export interface SponsorSystemTopologySynthesisResult {
  readonly registry: SponsorTopologyRegistry;
  readonly topology: SponsorSystemTopologyGraph;
  readonly execution: SponsorExecutionDependencyGraph;
  readonly lineage: SponsorTopologyLineage;
  readonly snapshot: SponsorTopologySnapshot;
  readonly envelope: SponsorDeterministicTopologyEnvelope;
}

export function runSystemTopologySynthesisLayer(
  inputs: ReadonlyArray<SponsorTopologyLayerInput> = [],
): SponsorSystemTopologySynthesisResult {
  const registry = buildTopologyRegistry();
  const topology = buildSystemTopologyGraph(inputs);
  const execution = resolveExecutionDependencies(topology);
  const lineage = computeTopologyLineage(topology);
  const snapshot = generateTopologySnapshot(topology, execution, lineage);
  const envelope = buildTopologyEnvelope(registry, topology, execution, lineage, snapshot);
  lockTopologyEnvelope(envelope);
  return Object.freeze({ registry, topology, execution, lineage, snapshot, envelope });
}

export function assertTopologyDeterminism(
  a: SponsorDeterministicTopologyEnvelope,
  b: SponsorDeterministicTopologyEnvelope,
): void {
  if (a.envelopeSignature !== b.envelopeSignature) {
    throw new SponsorTopologyDeterminismError(
      `envelope signature drift: ${a.envelopeSignature} ≠ ${b.envelopeSignature}`,
    );
  }
  if (a.snapshot.snapshotSignature !== b.snapshot.snapshotSignature) {
    throw new SponsorTopologyDeterminismError('snapshot signature drift');
  }
  if (a.topology.graphSignature !== b.topology.graphSignature) {
    throw new SponsorTopologyDeterminismError('topology graph signature drift');
  }
  if (a.execution.graphSignature !== b.execution.graphSignature) {
    throw new SponsorTopologyDeterminismError('execution graph signature drift');
  }
  if (a.lineage.lineageSignature !== b.lineage.lineageSignature) {
    throw new SponsorTopologyDeterminismError('lineage signature drift');
  }
  if (a.registry.registrySignature !== b.registry.registrySignature) {
    throw new SponsorTopologyDeterminismError('registry signature drift');
  }
}
