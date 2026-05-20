/**
 * Fase 1.9.3 — Equilibrium Resolution (READ-ONLY, pure).
 */
import type {
  EquilibriumClass,
  RuntimeEntropyEnvelope,
  RuntimePropagationEnergy,
  RuntimeStabilityField,
  RuntimeTopologyTension,
} from './equilibriumTypes';

export function resolveCanonicalEquilibrium(
  field: RuntimeStabilityField,
  entropy: RuntimeEntropyEnvelope,
  propagation: RuntimePropagationEnergy,
  topology: RuntimeTopologyTension,
): EquilibriumClass {
  if (field.collapsed || topology.collapsing) return 'COLLAPSED';
  if (topology.fractured || propagation.unbounded) return 'FRACTURED';
  if (entropy.level === 'CRITICAL' || entropy.level === 'HIGH') return 'TRANSIENT';
  if (propagation.amplified || entropy.level === 'MEDIUM') return 'META_STABLE';
  return 'STABLE';
}

export function detectResolutionFracture(classification: EquilibriumClass): boolean {
  return classification === 'FRACTURED' || classification === 'COLLAPSED';
}

export function detectEquilibriumRegression(prev: EquilibriumClass, next: EquilibriumClass): boolean {
  const rank: Record<EquilibriumClass, number> = { STABLE: 0, META_STABLE: 1, TRANSIENT: 2, FRACTURED: 3, COLLAPSED: 4 };
  return rank[next] > rank[prev];
}

export function calculateResolutionBalance(
  field: RuntimeStabilityField,
  entropy: RuntimeEntropyEnvelope,
  propagation: RuntimePropagationEnergy,
): number {
  return (field.globalStability + (1 - entropy.score) + propagation.containment) / 3;
}
