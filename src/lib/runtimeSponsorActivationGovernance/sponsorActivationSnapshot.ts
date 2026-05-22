import { canonicalize, djb2 } from './sponsorActivationInternals';
import { ACTIVATION_GATES } from './sponsorActivationGates';
import { ACTIVATION_PREREQUISITES } from './sponsorActivationPrerequisites';
import { buildRolloutGovernanceMatrix } from './sponsorRolloutGovernanceMatrix';
import { generateActivationInvariants } from './sponsorActivationInvariants';
import { computeActivationLineage } from './sponsorActivationLineage';
import { resolveActivationGraph } from './sponsorActivationReadinessGraph';
import { buildOperationalReadinessProofs } from './sponsorOperationalReadinessProofs';

export interface SponsorDeterministicActivationSnapshot {
  readonly snapshotId: string;
  readonly digest: string;
  readonly gateCount: number;
  readonly prerequisiteCount: number;
  readonly proofCount: number;
  readonly invariantCount: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export function generateActivationSnapshot(): SponsorDeterministicActivationSnapshot {
  const gates = ACTIVATION_GATES;
  const prereqs = ACTIVATION_PREREQUISITES;
  const matrix = buildRolloutGovernanceMatrix();
  const invariants = generateActivationInvariants();
  const lineage = computeActivationLineage();
  const graph = resolveActivationGraph();
  const proofs = buildOperationalReadinessProofs();

  const payload = canonicalize({
    gates,
    prereqs,
    matrix,
    invariants,
    lineage,
    graph,
    proofCount: proofs.length,
  });
  const digest = djb2(payload);

  return Object.freeze({
    snapshotId: `snapshot:activation:${digest}`,
    digest,
    gateCount: gates.length,
    prerequisiteCount: prereqs.length,
    proofCount: proofs.length,
    invariantCount: invariants.length,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
  });
}
