import type { FunctorCertification, FunctorObject, FunctorRisk, RuntimeEquilibriumFunctor, RuntimeFunctorComposition, RuntimeFunctorDeterminism, RuntimeFunctorEnvelope, RuntimeFunctorIdentity, RuntimeFunctorStability, RuntimeFunctorTopology } from './functorTypes';

export interface FunctorGuardViolation extends FunctorRisk { readonly envelopeId?: string; }

export function assertFunctorReadonly(objs: readonly FunctorObject[]): FunctorGuardViolation[] {
  const out: FunctorGuardViolation[] = [];
  for (const o of objs) {
    if (o.liveExecutionEnabled !== false || o.retryEnabled !== false || o.backgroundEnabled !== false || o.realUsersAllowed !== false || o.stage !== 'STAGE_0_READ_ONLY') {
      out.push({ code: 'FUNCTOR_READONLY_INVARIANT_BROKEN', severity: 'critical', description: `object ${o.id} viola invariantes` });
    }
  }
  return out;
}

export function assertFunctorDeterminism(a: string, b: string): FunctorGuardViolation[] {
  return a === b ? [] : [{ code: 'FUNCTOR_NON_DETERMINISTIC', severity: 'error', description: 'assinaturas divergentes' }];
}

export function assertNoFunctorMutation(before: RuntimeFunctorEnvelope, after: RuntimeFunctorEnvelope): FunctorGuardViolation[] {
  if (before === after) return [];
  if (before.functor.signature !== after.functor.signature) return [{ code: 'FUNCTOR_MUTATION_DETECTED', severity: 'critical', description: 'envelope mutado' }];
  return [];
}

export function assertNoFunctorCollapse(f: RuntimeEquilibriumFunctor): FunctorGuardViolation[] {
  return f.collapsed ? [{ code: 'FUNCTOR_COLLAPSED', severity: 'critical', description: 'functor colapsado' }] : [];
}

export function assertNoCompositionFailure(c: RuntimeFunctorComposition): FunctorGuardViolation[] {
  return c.failed ? [{ code: 'FUNCTOR_COMPOSITION_FAILED', severity: 'critical', description: 'composição falhou' }] : [];
}

export function assertNoIdentityBreak(i: RuntimeFunctorIdentity): FunctorGuardViolation[] {
  return i.broken ? [{ code: 'FUNCTOR_IDENTITY_BROKEN', severity: 'critical', description: 'identidade quebrada' }] : [];
}

export function assertNoDeterminismDegradation(d: RuntimeFunctorDeterminism): FunctorGuardViolation[] {
  return d.degraded ? [{ code: 'FUNCTOR_DETERMINISM_DEGRADED', severity: 'error', description: 'determinismo degradado' }] : [];
}

export function assertNoTopologyCollapse(t: RuntimeFunctorTopology): FunctorGuardViolation[] {
  return t.collapsed ? [{ code: 'FUNCTOR_TOPOLOGY_COLLAPSED', severity: 'critical', description: 'topologia colapsada' }] : [];
}

export function assertNoStabilityCollapse(s: RuntimeFunctorStability): FunctorGuardViolation[] {
  return s.collapsed ? [{ code: 'FUNCTOR_STABILITY_COLLAPSED', severity: 'critical', description: 'estabilidade colapsada' }] : [];
}

export function assertFunctorCertificationIntegrity(c: FunctorCertification): FunctorGuardViolation[] {
  return c.safe ? [] : [{ code: 'FUNCTOR_CERTIFICATION_INVALID', severity: c.rank === 'BLOCKED' ? 'critical' : 'error', description: c.reasons.join(',') || 'unsafe' }];
}
