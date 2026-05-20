/**
 * Fase 1.9.3 — Guards (READ-ONLY, never throws).
 */
import type {
  CanonicalEquilibriumState,
  EquilibriumNode,
  EquilibriumRisk,
  RuntimeDissipationEnvelope,
  RuntimeEntropyEnvelope,
  RuntimeEquilibriumEnvelope,
  RuntimePropagationEnergy,
  RuntimeTopologyTension,
} from './equilibriumTypes';

export interface EquilibriumGuardViolation extends EquilibriumRisk {
  readonly envelopeId?: string;
}

export function assertEquilibriumReadonly(nodes: readonly EquilibriumNode[]): EquilibriumGuardViolation[] {
  const out: EquilibriumGuardViolation[] = [];
  for (const n of nodes) {
    if (
      n.liveExecutionEnabled !== false ||
      n.retryEnabled !== false ||
      n.backgroundEnabled !== false ||
      n.realUsersAllowed !== false ||
      n.stage !== 'STAGE_0_READ_ONLY'
    ) {
      out.push({ code: 'EQUILIBRIUM_READONLY_INVARIANT_BROKEN', severity: 'critical', description: `node ${n.id} viola invariantes read-only` });
    }
  }
  return out;
}

export function assertEquilibriumDeterminism(a: string, b: string): EquilibriumGuardViolation[] {
  return a === b ? [] : [{ code: 'EQUILIBRIUM_NON_DETERMINISTIC', severity: 'error', description: 'assinaturas divergentes' }];
}

export function assertNoEntropyExplosion(e: RuntimeEntropyEnvelope): EquilibriumGuardViolation[] {
  if (e.level === 'CRITICAL' && e.escalating) {
    return [{ code: 'EQUILIBRIUM_ENTROPY_CRITICAL', severity: 'critical', description: 'entropia crítica em escalada' }];
  }
  return [];
}

export function assertNoUnboundedPropagation(p: RuntimePropagationEnergy): EquilibriumGuardViolation[] {
  if (p.unbounded) return [{ code: 'EQUILIBRIUM_PROPAGATION_UNBOUNDED', severity: 'critical', description: 'propagação ilimitada' }];
  return [];
}

export function assertNoTopologyCollapse(t: RuntimeTopologyTension): EquilibriumGuardViolation[] {
  if (t.collapsing) return [{ code: 'EQUILIBRIUM_TOPOLOGY_COLLAPSED', severity: 'critical', description: 'topologia colapsando' }];
  return [];
}

export function assertNoRecursiveAmplification(d: RuntimeDissipationEnvelope): EquilibriumGuardViolation[] {
  if (d.recursive) return [{ code: 'EQUILIBRIUM_RECURSIVE_AMPLIFICATION', severity: 'error', description: 'dissipação recursiva amplificando' }];
  return [];
}

export function assertCanonicalEquilibriumIntegrity(c: CanonicalEquilibriumState): EquilibriumGuardViolation[] {
  if (!c.normalized) return [{ code: 'EQUILIBRIUM_CANONICAL_DRIFT', severity: 'warn', description: 'assinatura canônica não normalizada' }];
  if (c.drift > 0.75) return [{ code: 'EQUILIBRIUM_CANONICAL_DRIFT', severity: 'error', description: `drift=${c.drift.toFixed(3)}` }];
  return [];
}

export function assertNoRuntimeMutation(before: RuntimeEquilibriumEnvelope, after: RuntimeEquilibriumEnvelope): EquilibriumGuardViolation[] {
  if (before === after) return [];
  if (before.field.signature !== after.field.signature) {
    return [{ code: 'EQUILIBRIUM_MUTATION_DETECTED', severity: 'critical', description: 'envelope mutado' }];
  }
  return [];
}
