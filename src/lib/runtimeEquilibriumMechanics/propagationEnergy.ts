/**
 * Fase 1.9.3 — Propagation Energy (READ-ONLY, pure).
 */
import type { EquilibriumNode, PropagationEnergy, RuntimePropagationEnergy } from './equilibriumTypes';

export function calculatePropagationEnergy(nodes: readonly EquilibriumNode[]): RuntimePropagationEnergy {
  if (nodes.length === 0) {
    return Object.freeze({ energy: 'STATIC', amplitude: 0, containment: 1, amplified: false, unbounded: false });
  }
  const totalEdges = nodes.reduce((a, n) => a + n.neighbors.length, 0);
  const amplitude = Math.min(1, totalEdges / (nodes.length * Math.max(1, nodes.length - 1)));
  const containment = calculateEnergyContainment(nodes);
  const amplified = detectEnergyAmplification(nodes);
  const unbounded = detectUnboundedPropagation(nodes);
  let energy: PropagationEnergy = 'STATIC';
  if (unbounded) energy = 'UNBOUNDED';
  else if (amplified) energy = 'ESCALATING';
  else if (amplitude > 0.4) energy = 'ACTIVE';
  else if (amplitude > 0) energy = 'CONTAINED';
  return Object.freeze({ energy, amplitude, containment, amplified, unbounded });
}

export function detectEnergyAmplification(nodes: readonly EquilibriumNode[]): boolean {
  if (nodes.length === 0) return false;
  const high = nodes.filter((n) => n.neighbors.length >= nodes.length * 0.5).length;
  return high / nodes.length >= 0.3;
}

export function detectUnboundedPropagation(nodes: readonly EquilibriumNode[]): boolean {
  if (nodes.length === 0) return false;
  const ids = new Set(nodes.map((n) => n.id));
  // unbounded = neighbor references outside known set
  for (const n of nodes) for (const nb of n.neighbors) if (!ids.has(nb)) return true;
  return false;
}

export function calculateEnergyContainment(nodes: readonly EquilibriumNode[]): number {
  if (nodes.length === 0) return 1;
  const ids = new Set(nodes.map((n) => n.id));
  let total = 0;
  let contained = 0;
  for (const n of nodes) for (const nb of n.neighbors) {
    total++;
    if (ids.has(nb)) contained++;
  }
  return total === 0 ? 1 : contained / total;
}
