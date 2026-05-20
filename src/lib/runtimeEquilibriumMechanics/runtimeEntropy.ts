/**
 * Fase 1.9.3 — Runtime Entropy (READ-ONLY, pure).
 */
import type { EntropyLevel, EquilibriumNode, RuntimeEntropyEnvelope } from './equilibriumTypes';

export function calculateRuntimeEntropy(nodes: readonly EquilibriumNode[]): RuntimeEntropyEnvelope {
  if (nodes.length === 0) {
    return Object.freeze({ level: 'NONE', score: 0, escalating: false, collapsed: false, distribution: Object.freeze([]) });
  }
  const dist = normalizeEntropyDistribution(nodes);
  // Energy-based: zero tension/potential → 0 (NONE). Grows with magnitude.
  const energy = nodes.reduce((a, n) => a + Math.abs(n.tension) + Math.abs(n.potential), 0);
  const score = Math.min(1, energy / (nodes.length * 20));
  const escalating = detectEntropyEscalation(dist);
  const collapsed = detectEntropyCollapse(dist);
  let level: EntropyLevel = 'NONE';
  if (score >= 0.85) level = 'CRITICAL';
  else if (score >= 0.65) level = 'HIGH';
  else if (score >= 0.4) level = 'MEDIUM';
  else if (score > 0.05) level = 'LOW';
  return Object.freeze({ level, score, escalating, collapsed, distribution: Object.freeze(dist) });
}

export function detectEntropyEscalation(dist: readonly number[]): boolean {
  if (dist.length < 2) return false;
  const max = Math.max(...dist);
  return max > 0.7;
}

export function detectEntropyCollapse(dist: readonly number[]): boolean {
  if (dist.length === 0) return false;
  return dist.every((p) => p === 0);
}

export function normalizeEntropyDistribution(nodes: readonly EquilibriumNode[]): number[] {
  const weights = nodes.map((n) => Math.abs(n.tension) + Math.abs(n.potential) + 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  return sum === 0 ? weights.map(() => 0) : weights.map((w) => w / sum);
}
