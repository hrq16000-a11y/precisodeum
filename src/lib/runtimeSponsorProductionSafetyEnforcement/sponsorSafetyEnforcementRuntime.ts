/**
 * Phase 1.9.48 — Safety enforcement runtime (deterministic facade).
 */
import { signObject, deepFreeze } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { evaluateRuntimeSafety, type RuntimeSafetyReport } from './sponsorRuntimeSafetyEvaluator';
import { buildExecutionInterdictionMatrix, type SponsorExecutionInterdictionMatrix } from './sponsorExecutionInterdictionMatrix';
import { buildActivationVetoGraph } from './sponsorActivationVetoGraph';
import { buildRuntimeKillSwitchGraph } from './sponsorRuntimeKillSwitchGraph';
import type { CanonicalGraph } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import type { SafetyConstraintInput } from './sponsorSafetyConstraintEngine';

export interface SafetyEnforcementRuntimeResult {
  readonly version: 'v1';
  readonly report: RuntimeSafetyReport;
  readonly interdictionMatrix: SponsorExecutionInterdictionMatrix;
  readonly vetoGraph: CanonicalGraph;
  readonly killSwitchGraph: CanonicalGraph;
  readonly runtimeSignature: string;
}

export function runSafetyEnforcementRuntime(input: SafetyConstraintInput = {}): SafetyEnforcementRuntimeResult {
  const report = evaluateRuntimeSafety(input);
  const interdictionMatrix = buildExecutionInterdictionMatrix();
  const vetoGraph = buildActivationVetoGraph();
  const killSwitchGraph = buildRuntimeKillSwitchGraph();
  return deepFreeze({
    version: 'v1' as const,
    report,
    interdictionMatrix,
    vetoGraph,
    killSwitchGraph,
    runtimeSignature: signObject({
      rep: report.reportSignature,
      mtx: interdictionMatrix.matrixSignature,
      vt: vetoGraph.graphSignature,
      ks: killSwitchGraph.graphSignature,
    }),
  });
}
