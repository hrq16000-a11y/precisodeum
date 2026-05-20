import type { ManifoldNode, RuntimeEquilibriumManifold } from './manifoldTypes';
export function normalizeManifold(values: readonly number[]): readonly number[] { const max = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0); if (max === 0) return Object.freeze([...values]); return Object.freeze(values.map((v) => v / max)); }
export function calculateManifoldSymmetry(values: readonly number[]): number { if (values.length === 0) return 1; const mean = values.reduce((a, v) => a + v, 0) / values.length; const dev = values.reduce((a, v) => a + Math.abs(v - mean), 0) / values.length; return 1 / (1 + dev); }
export function detectManifoldInstability(values: readonly number[]): boolean { return values.some((v) => Math.abs(v) > 0.95); }
export function buildEquilibriumManifold(nodes: readonly ManifoldNode[]): RuntimeEquilibriumManifold {
  const raw = nodes.map((n) => n.position + n.tension + n.elasticity);
  const field = normalizeManifold(raw);
  const symmetry = calculateManifoldSymmetry(field);
  const unstable = detectManifoldInstability(field);
  const signature = `manifold:${field.length}:${symmetry.toFixed(3)}:${unstable ? '1' : '0'}`;
  return Object.freeze({ field, symmetry, normalized: true, unstable, signature });
}
