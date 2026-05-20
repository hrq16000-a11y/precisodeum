import type { InstabilityDensity, RuntimeInstabilityDensityEnvelope, TensorNode } from './tensorTypes';
export function normalizeDensityDistribution(nodes: readonly TensorNode[]): readonly number[] { const total = nodes.reduce((a, n) => a + Math.abs(n.density), 0); if (total === 0) return Object.freeze(nodes.map(() => 0)); return Object.freeze(nodes.map((n) => Math.abs(n.density) / total)); }
export function detectDensityAmplification(dist: readonly number[]): boolean { return dist.some((d) => d > 0.7); }
export function detectCriticalDensity(score: number): boolean { return score >= 0.85; }
export function calculateInstabilityDensity(nodes: readonly TensorNode[]): RuntimeInstabilityDensityEnvelope {
  const distribution = normalizeDensityDistribution(nodes);
  const score = nodes.length === 0 ? 0 : nodes.reduce((a, n) => a + Math.abs(n.density), 0) / (nodes.length * 10);
  const amplified = detectDensityAmplification(distribution);
  let level: InstabilityDensity = 'VOID';
  if (detectCriticalDensity(score)) level = 'CRITICAL'; else if (score >= 0.6) level = 'HIGH'; else if (score >= 0.3) level = 'MEDIUM'; else if (score > 0) level = 'LOW';
  return Object.freeze({ level, score, amplified, distribution });
}
