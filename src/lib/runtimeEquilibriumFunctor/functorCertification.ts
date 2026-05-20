import type { FunctorCertification, FunctorObject, FunctorRisk, RuntimeEquilibriumFunctor, RuntimeFunctorComposition, RuntimeFunctorDeterminism, RuntimeFunctorEquivalence, RuntimeFunctorIdentity, RuntimeFunctorNormalization, RuntimeFunctorStability, RuntimeFunctorTopology } from './functorTypes';

export interface CertifyFunctorInput {
  readonly objects: readonly FunctorObject[];
  readonly functor: RuntimeEquilibriumFunctor;
  readonly composition: RuntimeFunctorComposition;
  readonly identity: RuntimeFunctorIdentity;
  readonly normalization: RuntimeFunctorNormalization;
  readonly determinism: RuntimeFunctorDeterminism;
  readonly equivalence: RuntimeFunctorEquivalence;
  readonly topology: RuntimeFunctorTopology;
  readonly stability: RuntimeFunctorStability;
}

export function detectUnsafeFunctorState(objs: readonly FunctorObject[]): string[] {
  const r: string[] = [];
  for (const o of objs) {
    if (o.liveExecutionEnabled !== false) r.push(`live:${o.id}`);
    if (o.retryEnabled !== false) r.push(`retry:${o.id}`);
    if (o.backgroundEnabled !== false) r.push(`bg:${o.id}`);
    if (o.realUsersAllowed !== false) r.push(`users:${o.id}`);
    if (o.stage !== 'STAGE_0_READ_ONLY') r.push(`stage:${o.id}`);
  }
  return r;
}

export function calculateFunctorConfidence(i: CertifyFunctorInput): number {
  const p = [i.functor.preservation, i.composition.associativity, i.identity.preservation, i.normalization.stability, i.determinism.score, i.equivalence.strength, i.topology.connectivity, i.stability.score];
  return p.reduce((a, b) => a + b, 0) / p.length;
}

export function certifyFunctorStability(i: CertifyFunctorInput): FunctorCertification {
  const unsafe = detectUnsafeFunctorState(i.objects);
  const confidence = calculateFunctorConfidence(i);
  const reasons: string[] = [...unsafe];
  if (i.functor.collapsed) reasons.push('functor_collapsed');
  if (i.composition.broken) reasons.push('composition_broken');
  if (i.identity.broken) reasons.push('identity_broken');
  if (i.normalization.divergent) reasons.push('normalization_divergent');
  if (i.determinism.degraded) reasons.push('determinism_degraded');
  if (i.equivalence.fractured) reasons.push('equivalence_fractured');
  if (i.topology.collapsed) reasons.push('topology_collapsed');
  if (i.stability.collapsed) reasons.push('stability_collapsed');
  const safe = reasons.length === 0;
  const blocked = unsafe.length > 0 || i.functor.collapsed || i.topology.collapsed || i.stability.collapsed;
  const rank: 'OK' | 'WARN' | 'BLOCKED' = blocked ? 'BLOCKED' : safe ? 'OK' : 'WARN';
  return Object.freeze({ safe, confidence, rank, reasons: Object.freeze(reasons) });
}

export function assertFunctorSafety(c: FunctorCertification): readonly FunctorRisk[] {
  if (c.safe) return Object.freeze([]);
  const sev = c.rank === 'BLOCKED' ? 'critical' : 'error';
  return Object.freeze(c.reasons.map((r) => Object.freeze({ code: 'FUNCTOR_UNSAFE', severity: sev as 'critical' | 'error', description: r })));
}
