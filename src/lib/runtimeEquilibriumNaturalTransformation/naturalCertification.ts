import type { NaturalCertification, NaturalComponent, NaturalityRisk, RuntimeCommutativeDiagram, RuntimeNaturalComposition, RuntimeNaturalDeterminism, RuntimeNaturalEquivalence, RuntimeNaturalIdentity, RuntimeNaturalNormalization, RuntimeNaturalStability, RuntimeNaturalTopology, RuntimeNaturalTransformation, RuntimeNaturalityConditions } from './naturalTransformationTypes';

export interface CertifyNaturalInput {
  readonly components: readonly NaturalComponent[];
  readonly transformation: RuntimeNaturalTransformation;
  readonly composition: RuntimeNaturalComposition;
  readonly identity: RuntimeNaturalIdentity;
  readonly normalization: RuntimeNaturalNormalization;
  readonly determinism: RuntimeNaturalDeterminism;
  readonly equivalence: RuntimeNaturalEquivalence;
  readonly topology: RuntimeNaturalTopology;
  readonly stability: RuntimeNaturalStability;
  readonly diagram: RuntimeCommutativeDiagram;
  readonly naturalityConditions: RuntimeNaturalityConditions;
}

export function detectUnsafeNaturalState(comps: readonly NaturalComponent[]): string[] {
  const r: string[] = [];
  for (const c of comps) {
    if (c.liveExecutionEnabled !== false) r.push(`live:${c.id}`);
    if (c.retryEnabled !== false) r.push(`retry:${c.id}`);
    if (c.backgroundEnabled !== false) r.push(`bg:${c.id}`);
    if (c.realUsersAllowed !== false) r.push(`users:${c.id}`);
    if (c.stage !== 'STAGE_0_READ_ONLY') r.push(`stage:${c.id}`);
  }
  return r;
}

export function calculateNaturalConfidence(i: CertifyNaturalInput): number {
  const p = [i.transformation.naturality, i.composition.associativity, i.identity.preservation, i.normalization.stability, i.determinism.score, i.equivalence.strength, i.topology.connectivity, i.stability.score, i.diagram.commutativity, i.naturalityConditions.score];
  return p.reduce((a, b) => a + b, 0) / p.length;
}

export function certifyNaturalStability(i: CertifyNaturalInput): NaturalCertification {
  const unsafe = detectUnsafeNaturalState(i.components);
  const confidence = calculateNaturalConfidence(i);
  const reasons: string[] = [...unsafe];
  if (i.transformation.collapsed) reasons.push('transformation_collapsed');
  if (i.composition.broken) reasons.push('composition_broken');
  if (i.identity.broken) reasons.push('identity_broken');
  if (i.normalization.divergent) reasons.push('normalization_divergent');
  if (i.determinism.degraded) reasons.push('determinism_degraded');
  if (i.equivalence.fractured) reasons.push('equivalence_fractured');
  if (i.topology.collapsed) reasons.push('topology_collapsed');
  if (i.stability.collapsed) reasons.push('stability_collapsed');
  if (i.diagram.failed) reasons.push('diagram_failed');
  if (!i.naturalityConditions.satisfied) reasons.push('naturality_violated');
  const safe = reasons.length === 0;
  const blocked = unsafe.length > 0 || i.transformation.collapsed || i.topology.collapsed || i.stability.collapsed || i.diagram.failed;
  const rank: 'OK' | 'WARN' | 'BLOCKED' = blocked ? 'BLOCKED' : safe ? 'OK' : 'WARN';
  return Object.freeze({ safe, confidence, rank, reasons: Object.freeze(reasons) });
}

export function assertNaturalSafety(c: NaturalCertification): readonly NaturalityRisk[] {
  if (c.safe) return Object.freeze([]);
  const sev = c.rank === 'BLOCKED' ? 'critical' : 'error';
  return Object.freeze(c.reasons.map((r) => Object.freeze({ code: 'NATURAL_UNSAFE', severity: sev as 'critical' | 'error', description: r })));
}
