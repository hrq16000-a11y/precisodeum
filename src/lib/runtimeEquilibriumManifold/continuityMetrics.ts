import type { ManifoldNode, RuntimeContinuityMetric } from './manifoldTypes';
export function normalizeMetricDistribution(nodes: readonly ManifoldNode[]): readonly number[] { const total = nodes.reduce((a, n) => a + Math.abs(n.tension), 0); if (total === 0) return Object.freeze(nodes.map(() => 0)); return Object.freeze(nodes.map((n) => Math.abs(n.tension) / total)); }
export function detectMetricInstability(dist: readonly number[]): boolean { return dist.some((d) => d > 0.7); }
export function calculateMetricEquilibrium(nodes: readonly ManifoldNode[]): number { if (nodes.length < 2) return 1; const diffs: number[] = []; for (let i = 1; i < nodes.length; i++) diffs.push(Math.abs(nodes[i].position - nodes[i - 1].position)); const avg = diffs.reduce((a, v) => a + v, 0) / diffs.length; return 1 / (1 + avg); }
export function calculateContinuityMetrics(nodes: readonly ManifoldNode[]): RuntimeContinuityMetric {
  const distribution = normalizeMetricDistribution(nodes);
  const score = nodes.length === 0 ? 1 : 1 - (nodes.reduce((a, n) => a + Math.abs(n.tension), 0) / (nodes.length * 10));
  const equilibrium = calculateMetricEquilibrium(nodes);
  const stable = !detectMetricInstability(distribution);
  return Object.freeze({ score, stable, distribution, equilibrium });
}
