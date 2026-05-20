import { assertNoCriticalDensity, assertNoTerminalSingularity, assertNoTopologyCollapse, assertNoUnboundedCurvature, assertTensorCertificationIntegrity, assertTensorReadonly, type TensorGuardViolation } from './tensorGuards';
import type { RuntimeTensorEnvelope } from './tensorTypes';
export function assertAllTensorIntegrity(envelopes: readonly RuntimeTensorEnvelope[]): readonly TensorGuardViolation[] {
  const out: TensorGuardViolation[] = [];
  for (const env of envelopes) {
    const tag = (vs: TensorGuardViolation[]) => vs.map((v) => ({ ...v, envelopeId: env.id }));
    out.push(...tag(assertTensorReadonly(env.geometry.nodes)));
    out.push(...tag(assertNoUnboundedCurvature(env.curvature)));
    out.push(...tag(assertNoCriticalDensity(env.density)));
    out.push(...tag(assertNoTopologyCollapse(env.topology)));
    out.push(...tag(assertNoTerminalSingularity(env.singularity)));
    out.push(...tag(assertTensorCertificationIntegrity(env.certification)));
  }
  return Object.freeze(out);
}
