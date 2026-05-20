import type { HigherOrderCertification, HigherOrderComponent, HigherOrderRisk, RuntimeHigherOrderComposition, RuntimeHigherOrderDeterminism, RuntimeHigherOrderEnvelope, RuntimeHigherOrderFunctoriality, RuntimeHigherOrderIdentity, RuntimeHigherOrderNaturality, RuntimeHigherOrderStability, RuntimeHigherOrderTopology, RuntimeHigherOrderTransformation, RuntimeTransformationLifting } from './higherOrderTypes';

export interface HigherOrderGuardViolation extends HigherOrderRisk { readonly envelopeId?: string; }

export function assertHigherOrderReadonly(comps: readonly HigherOrderComponent[]): HigherOrderGuardViolation[] {
  const out: HigherOrderGuardViolation[] = [];
  for (const c of comps) {
    if (c.liveExecutionEnabled !== false || c.retryEnabled !== false || c.backgroundEnabled !== false || c.realUsersAllowed !== false || c.stage !== 'STAGE_0_READ_ONLY') {
      out.push({ code: 'HIGHER_ORDER_READONLY_INVARIANT_BROKEN', severity: 'critical', description: `component ${c.id} viola invariantes` });
    }
  }
  return out;
}

export function assertHigherOrderDeterminism(a: string, b: string): HigherOrderGuardViolation[] {
  return a === b ? [] : [{ code: 'HIGHER_ORDER_NON_DETERMINISTIC', severity: 'error', description: 'assinaturas divergentes' }];
}

export function assertNoHigherOrderMutation(before: RuntimeHigherOrderEnvelope, after: RuntimeHigherOrderEnvelope): HigherOrderGuardViolation[] {
  if (before === after) return [];
  if (before.transformation.signature !== after.transformation.signature) return [{ code: 'HIGHER_ORDER_MUTATION_DETECTED', severity: 'critical', description: 'envelope mutado' }];
  return [];
}

export function assertNoHigherOrderCollapse(t: RuntimeHigherOrderTransformation): HigherOrderGuardViolation[] {
  return t.collapsed ? [{ code: 'HIGHER_ORDER_COLLAPSED', severity: 'critical', description: 'transformação colapsada' }] : [];
}

export function assertNoHigherOrderCompositionFailure(c: RuntimeHigherOrderComposition): HigherOrderGuardViolation[] {
  return c.failed ? [{ code: 'HIGHER_ORDER_COMPOSITION_FAILED', severity: 'critical', description: 'composição falhou' }] : [];
}

export function assertNoHigherOrderIdentityBreak(i: RuntimeHigherOrderIdentity): HigherOrderGuardViolation[] {
  return i.broken ? [{ code: 'HIGHER_ORDER_IDENTITY_BROKEN', severity: 'critical', description: 'identidade quebrada' }] : [];
}

export function assertNoHigherOrderDeterminismDegradation(d: RuntimeHigherOrderDeterminism): HigherOrderGuardViolation[] {
  return d.degraded ? [{ code: 'HIGHER_ORDER_DETERMINISM_DEGRADED', severity: 'error', description: 'determinismo degradado' }] : [];
}

export function assertNoHigherOrderTopologyCollapse(t: RuntimeHigherOrderTopology): HigherOrderGuardViolation[] {
  return t.collapsed ? [{ code: 'HIGHER_ORDER_TOPOLOGY_COLLAPSED', severity: 'critical', description: 'topologia colapsada' }] : [];
}

export function assertNoHigherOrderStabilityCollapse(s: RuntimeHigherOrderStability): HigherOrderGuardViolation[] {
  return s.collapsed ? [{ code: 'HIGHER_ORDER_STABILITY_COLLAPSED', severity: 'critical', description: 'estabilidade colapsada' }] : [];
}

export function assertNoHigherOrderNaturalityBreak(n: RuntimeHigherOrderNaturality): HigherOrderGuardViolation[] {
  return n.broken ? [{ code: 'HIGHER_ORDER_NATURALITY_BROKEN', severity: 'critical', description: 'naturalidade quebrada' }] : [];
}

export function assertNoHigherOrderFunctorialityFailure(f: RuntimeHigherOrderFunctoriality): HigherOrderGuardViolation[] {
  return f.failed ? [{ code: 'HIGHER_ORDER_FUNCTORIALITY_FAILED', severity: 'critical', description: 'functorialidade falhou' }] : [];
}

export function assertNoUnliftableTransformation(l: RuntimeTransformationLifting): HigherOrderGuardViolation[] {
  return l.unliftable ? [{ code: 'HIGHER_ORDER_LIFTING_UNLIFTABLE', severity: 'critical', description: 'lifting impossível' }] : [];
}

export function assertHigherOrderCertificationIntegrity(c: HigherOrderCertification): HigherOrderGuardViolation[] {
  return c.safe ? [] : [{ code: 'HIGHER_ORDER_CERTIFICATION_INVALID', severity: c.rank === 'BLOCKED' ? 'critical' : 'error', description: c.reasons.join(',') || 'unsafe' }];
}
