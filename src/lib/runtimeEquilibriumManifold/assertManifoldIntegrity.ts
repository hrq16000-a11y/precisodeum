import { assertManifoldCertificationIntegrity, assertManifoldReadonly, assertNoContinuityCollapse, assertNoInfiniteGeodesics, assertNoIrreversibleDeformation, assertNoTerminalContinuumSingularity, type ManifoldGuardViolation } from './manifoldGuards';
import type { RuntimeManifoldEnvelope } from './manifoldTypes';
export function assertAllManifoldIntegrity(envelopes: readonly RuntimeManifoldEnvelope[]): readonly ManifoldGuardViolation[] {
  const out: ManifoldGuardViolation[] = [];
  for (const env of envelopes) {
    const tag = (vs: ManifoldGuardViolation[]) => vs.map((v) => ({ ...v, envelopeId: env.id }));
    out.push(...tag(assertManifoldReadonly(env.continuum.nodes)));
    out.push(...tag(assertNoInfiniteGeodesics(env.geodesic)));
    out.push(...tag(assertNoContinuityCollapse(env.continuity)));
    out.push(...tag(assertNoIrreversibleDeformation(env.deformation)));
    out.push(...tag(assertNoTerminalContinuumSingularity(env.singularity)));
    out.push(...tag(assertManifoldCertificationIntegrity(env.certification)));
  }
  return Object.freeze(out);
}
