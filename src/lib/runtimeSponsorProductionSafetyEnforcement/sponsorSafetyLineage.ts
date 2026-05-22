/**
 * Phase 1.9.48 — Safety lineage.
 */
import { buildCanonicalLineage, type CanonicalLineage, type CanonicalProofMatrix } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { SafetyEnforcementRuntimeResult } from './sponsorSafetyEnforcementRuntime';

export function buildSafetyLineage(
  runtime: SafetyEnforcementRuntimeResult,
  proofs: CanonicalProofMatrix,
): CanonicalLineage {
  return buildCanonicalLineage([
    { key: 'evaluation', signature: runtime.report.evaluation.evaluationSignature },
    { key: 'decision', signature: runtime.report.decision.decisionSignature },
    { key: 'report', signature: runtime.report.reportSignature },
    { key: 'interdiction', signature: runtime.interdictionMatrix.matrixSignature },
    { key: 'veto_graph', signature: runtime.vetoGraph.graphSignature },
    { key: 'kill_switch_graph', signature: runtime.killSwitchGraph.graphSignature },
    { key: 'proofs', signature: proofs.proofsSignature },
    { key: 'runtime', signature: runtime.runtimeSignature },
  ]);
}
