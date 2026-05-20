import type { CurvatureClass, RuntimeCurvatureEnvelope, TensorNode } from './tensorTypes';
export function calculateCurvatureContainment(nodes: readonly TensorNode[]): number { if (nodes.length === 0) return 1; const avg = nodes.reduce((a, n) => a + Math.abs(n.curvature), 0) / nodes.length; return 1 / (1 + avg); }
export function detectRecursiveCurvature(nodes: readonly TensorNode[]): boolean { const seen = new Set<string>(); for (const n of nodes) { if (seen.has(n.id)) return true; seen.add(n.id); } return nodes.some((n) => n.neighbors.includes(n.id)); }
export function detectUnboundedCurvature(nodes: readonly TensorNode[]): boolean { return nodes.some((n) => Math.abs(n.curvature) > 9); }
export function calculatePropagationCurvature(nodes: readonly TensorNode[]): RuntimeCurvatureEnvelope {
  const containment = calculateCurvatureContainment(nodes);
  const recursive = detectRecursiveCurvature(nodes);
  const unbounded = detectUnboundedCurvature(nodes);
  const value = nodes.reduce((a, n) => a + Math.abs(n.curvature), 0);
  let cls: CurvatureClass = 'FLAT';
  if (unbounded) cls = 'UNBOUNDED'; else if (recursive) cls = 'RECURSIVE'; else if (value > nodes.length * 2) cls = 'AMPLIFIED'; else if (value > 0) cls = 'CONTAINED';
  return Object.freeze({ class: cls, value, containment, recursive, unbounded });
}
