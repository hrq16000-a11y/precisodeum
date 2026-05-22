/**
 * Phase 1.9.48 — Safety snapshot.
 */
import { createDeterministicSnapshot, type DeterministicSnapshot } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { CanonicalLineage, CanonicalProofMatrix } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { SafetyEnforcementRuntimeResult } from './sponsorSafetyEnforcementRuntime';

export interface SafetySnapshotPayload {
  readonly runtimeSignature: string;
  readonly reportSignature: string;
  readonly evaluationSignature: string;
  readonly decisionSignature: string;
  readonly interdictionSignature: string;
  readonly vetoGraphSignature: string;
  readonly killSwitchGraphSignature: string;
  readonly proofsSignature: string;
  readonly lineageSignature: string;
  readonly terminalSignature: string;
}

export function buildSafetySnapshot(
  runtime: SafetyEnforcementRuntimeResult,
  lineage: CanonicalLineage,
  proofs: CanonicalProofMatrix,
): DeterministicSnapshot<SafetySnapshotPayload> {
  return createDeterministicSnapshot<SafetySnapshotPayload>({
    runtimeSignature: runtime.runtimeSignature,
    reportSignature: runtime.report.reportSignature,
    evaluationSignature: runtime.report.evaluation.evaluationSignature,
    decisionSignature: runtime.report.decision.decisionSignature,
    interdictionSignature: runtime.interdictionMatrix.matrixSignature,
    vetoGraphSignature: runtime.vetoGraph.graphSignature,
    killSwitchGraphSignature: runtime.killSwitchGraph.graphSignature,
    proofsSignature: proofs.proofsSignature,
    lineageSignature: lineage.lineageSignature,
    terminalSignature: lineage.terminalSignature,
  });
}
