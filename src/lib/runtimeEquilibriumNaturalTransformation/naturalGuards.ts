import type { NaturalCertification, NaturalComponent, NaturalityRisk, RuntimeCommutativeDiagram, RuntimeNaturalComposition, RuntimeNaturalDeterminism, RuntimeNaturalEnvelope, RuntimeNaturalIdentity, RuntimeNaturalStability, RuntimeNaturalTopology, RuntimeNaturalTransformation, RuntimeNaturalityConditions } from './naturalTransformationTypes';

export interface NaturalGuardViolation extends NaturalityRisk { readonly envelopeId?: string; }

export function assertNaturalReadonly(comps: readonly NaturalComponent[]): NaturalGuardViolation[] {
  const out: NaturalGuardViolation[] = [];
  for (const c of comps) {
    if (c.liveExecutionEnabled !== false || c.retryEnabled !== false || c.backgroundEnabled !== false || c.realUsersAllowed !== false || c.stage !== 'STAGE_0_READ_ONLY') {
      out.push({ code: 'NATURAL_READONLY_INVARIANT_BROKEN', severity: 'critical', description: `component ${c.id} viola invariantes` });
    }
  }
  return out;
}

export function assertNaturalDeterminism(a: string, b: string): NaturalGuardViolation[] {
  return a === b ? [] : [{ code: 'NATURAL_NON_DETERMINISTIC', severity: 'error', description: 'assinaturas divergentes' }];
}

export function assertNoNaturalMutation(before: RuntimeNaturalEnvelope, after: RuntimeNaturalEnvelope): NaturalGuardViolation[] {
  if (before === after) return [];
  if (before.transformation.signature !== after.transformation.signature) return [{ code: 'NATURAL_MUTATION_DETECTED', severity: 'critical', description: 'envelope mutado' }];
  return [];
}

export function assertNoTransformationCollapse(t: RuntimeNaturalTransformation): NaturalGuardViolation[] {
  return t.collapsed ? [{ code: 'NATURAL_TRANSFORMATION_COLLAPSED', severity: 'critical', description: 'transformação colapsada' }] : [];
}

export function assertNoCompositionFailure(c: RuntimeNaturalComposition): NaturalGuardViolation[] {
  return c.failed ? [{ code: 'NATURAL_COMPOSITION_FAILED', severity: 'critical', description: 'composição falhou' }] : [];
}

export function assertNoIdentityBreak(i: RuntimeNaturalIdentity): NaturalGuardViolation[] {
  return i.broken ? [{ code: 'NATURAL_IDENTITY_BROKEN', severity: 'critical', description: 'identidade quebrada' }] : [];
}

export function assertNoDeterminismDegradation(d: RuntimeNaturalDeterminism): NaturalGuardViolation[] {
  return d.degraded ? [{ code: 'NATURAL_DETERMINISM_DEGRADED', severity: 'error', description: 'determinismo degradado' }] : [];
}

export function assertNoTopologyCollapse(t: RuntimeNaturalTopology): NaturalGuardViolation[] {
  return t.collapsed ? [{ code: 'NATURAL_TOPOLOGY_COLLAPSED', severity: 'critical', description: 'topologia colapsada' }] : [];
}

export function assertNoStabilityCollapse(s: RuntimeNaturalStability): NaturalGuardViolation[] {
  return s.collapsed ? [{ code: 'NATURAL_STABILITY_COLLAPSED', severity: 'critical', description: 'estabilidade colapsada' }] : [];
}

export function assertNoDiagramFailure(d: RuntimeCommutativeDiagram): NaturalGuardViolation[] {
  return d.failed ? [{ code: 'NATURAL_DIAGRAM_FAILED', severity: 'critical', description: 'diagrama não comutativo' }] : [];
}

export function assertNaturalityConditions(n: RuntimeNaturalityConditions): NaturalGuardViolation[] {
  return n.satisfied ? [] : [{ code: 'NATURALITY_CONDITION_VIOLATED', severity: 'error', description: `${n.violations} violações` }];
}

export function assertNaturalCertificationIntegrity(c: NaturalCertification): NaturalGuardViolation[] {
  return c.safe ? [] : [{ code: 'NATURAL_CERTIFICATION_INVALID', severity: c.rank === 'BLOCKED' ? 'critical' : 'error', description: c.reasons.join(',') || 'unsafe' }];
}
