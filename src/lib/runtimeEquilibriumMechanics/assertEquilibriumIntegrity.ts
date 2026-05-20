/**
 * Fase 1.9.3 — Final aggregate assert (READ-ONLY).
 */
import {
  assertCanonicalEquilibriumIntegrity,
  assertEquilibriumReadonly,
  assertNoEntropyExplosion,
  assertNoRecursiveAmplification,
  assertNoTopologyCollapse,
  assertNoUnboundedPropagation,
  type EquilibriumGuardViolation,
} from './equilibriumGuards';
import type { RuntimeEquilibriumEnvelope } from './equilibriumTypes';

export function assertAllEquilibriumIntegrity(
  envelopes: readonly RuntimeEquilibriumEnvelope[],
): readonly EquilibriumGuardViolation[] {
  const out: EquilibriumGuardViolation[] = [];
  for (const env of envelopes) {
    const tag = (vs: EquilibriumGuardViolation[]) => vs.map((v) => ({ ...v, envelopeId: env.id }));
    out.push(...tag(assertEquilibriumReadonly(env.field.nodes)));
    out.push(...tag(assertNoEntropyExplosion(env.entropy)));
    out.push(...tag(assertNoUnboundedPropagation(env.propagation)));
    out.push(...tag(assertNoTopologyCollapse(env.topology)));
    out.push(...tag(assertNoRecursiveAmplification(env.dissipation)));
    out.push(...tag(assertCanonicalEquilibriumIntegrity(env.canonical)));
    if (!env.certification.safe) {
      out.push({ code: 'EQUILIBRIUM_CERTIFICATION_INVALID', severity: env.certification.rank === 'BLOCKED' ? 'critical' : 'error', description: env.certification.reasons.join(',') || 'unsafe', envelopeId: env.id });
    }
  }
  return Object.freeze(out);
}
