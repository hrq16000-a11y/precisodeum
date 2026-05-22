/**
 * Phase 1.9.47 — Sandbox lineage.
 */
import { buildCanonicalLineage, type CanonicalLineage } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { SandboxActivationFlowResult } from './sponsorSandboxExecutionRuntime';
import type { CanonicalProofMatrix, CanonicalGraph } from '@/lib/runtimeSponsorMetaPlaneRuntime';

export function buildSandboxLineage(
  flow: SandboxActivationFlowResult,
  proofs: CanonicalProofMatrix,
  executionGraph: CanonicalGraph,
  dependencyTopology: CanonicalGraph,
): CanonicalLineage {
  return buildCanonicalLineage([
    { key: 'rollout', signature: flow.rollout.simulationSignature },
    { key: 'exposure', signature: flow.exposure.simulationSignature },
    { key: 'flow', signature: flow.flowSignature },
    { key: 'proofs', signature: proofs.proofsSignature },
    { key: 'execution_graph', signature: executionGraph.graphSignature },
    { key: 'dependency_topology', signature: dependencyTopology.graphSignature },
  ]);
}
