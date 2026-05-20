/**
 * Fase 1.9.3 — Stability Field (READ-ONLY, pure).
 */
import type { EquilibriumNode, RuntimeStabilityField } from './equilibriumTypes';

function sig(nodes: readonly EquilibriumNode[]): string {
  return nodes
    .map((n) => `${n.id}:${n.layer}:${n.stage}:${n.potential}:${n.tension}:${n.neighbors.join(',')}`)
    .sort()
    .join('|');
}

export function buildStabilityField(nodes: readonly EquilibriumNode[]): RuntimeStabilityField {
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const frozen = Object.freeze(sorted.map((n) => Object.freeze({ ...n, neighbors: Object.freeze([...n.neighbors]) })));
  const pressure = calculateFieldPressure(frozen);
  const leakage = detectFieldLeakage(frozen);
  const equilibrium = calculateFieldEquilibrium(frozen);
  const collapsed = detectFieldCollapse(frozen);
  const localStability = frozen.length === 0 ? 1 : Math.max(0, 1 - pressure);
  const globalStability = Math.max(0, Math.min(1, equilibrium - leakage));
  return Object.freeze({
    nodes: frozen,
    pressure,
    leakage,
    localStability,
    globalStability,
    collapsed,
    signature: sig(frozen),
  });
}

export function calculateFieldPressure(nodes: readonly EquilibriumNode[]): number {
  if (nodes.length === 0) return 0;
  const total = nodes.reduce((a, n) => a + Math.abs(n.tension), 0);
  return Math.min(1, total / (nodes.length * 10));
}

export function detectFieldCollapse(nodes: readonly EquilibriumNode[]): boolean {
  if (nodes.length === 0) return false;
  const critical = nodes.filter((n) => n.tension >= 10 && n.potential <= -10).length;
  return critical / nodes.length >= 0.5;
}

export function detectFieldLeakage(nodes: readonly EquilibriumNode[]): number {
  if (nodes.length === 0) return 0;
  const orphan = nodes.filter((n) => n.neighbors.length === 0).length;
  return orphan / nodes.length;
}

export function calculateFieldEquilibrium(nodes: readonly EquilibriumNode[]): number {
  if (nodes.length === 0) return 1;
  const avg = nodes.reduce((a, n) => a + n.potential, 0) / nodes.length;
  const variance = nodes.reduce((a, n) => a + (n.potential - avg) ** 2, 0) / nodes.length;
  return Math.max(0, 1 - Math.min(1, variance / 100));
}
