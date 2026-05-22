/**
 * Phase 1.9.47 — Sandbox deterministic snapshot.
 */
import { createDeterministicSnapshot, type DeterministicSnapshot } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { SandboxActivationFlowResult } from './sponsorSandboxExecutionRuntime';
import type { CanonicalLineage, CanonicalProofMatrix, CanonicalGraph } from '@/lib/runtimeSponsorMetaPlaneRuntime';

export interface SandboxSnapshotPayload {
  readonly flowSignature: string;
  readonly rolloutSignature: string;
  readonly exposureSignature: string;
  readonly proofsSignature: string;
  readonly executionGraphSignature: string;
  readonly dependencyTopologySignature: string;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export function buildSandboxSnapshot(
  flow: SandboxActivationFlowResult,
  lineage: CanonicalLineage,
  proofs: CanonicalProofMatrix,
  executionGraph: CanonicalGraph,
  dependencyTopology: CanonicalGraph,
): DeterministicSnapshot<SandboxSnapshotPayload> {
  return createDeterministicSnapshot<SandboxSnapshotPayload>({
    flowSignature: flow.flowSignature,
    rolloutSignature: flow.rollout.simulationSignature,
    exposureSignature: flow.exposure.simulationSignature,
    proofsSignature: proofs.proofsSignature,
    executionGraphSignature: executionGraph.graphSignature,
    dependencyTopologySignature: dependencyTopology.graphSignature,
    lineageSignature: lineage.lineageSignature,
    terminalSignature: lineage.terminalSignature,
  });
}
