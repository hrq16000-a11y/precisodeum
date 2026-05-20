import type { ManifoldNode } from './manifoldTypes';
export interface ConvergenceContinuityResult { readonly continuous: boolean; readonly discontinuous: boolean; readonly recursiveBreak: boolean; readonly gradient: number; }
export function calculateContinuityGradient(nodes: readonly ManifoldNode[]): number { if (nodes.length < 2) return 0; let g = 0; for (let i = 1; i < nodes.length; i++) g += Math.abs(nodes[i].position - nodes[i - 1].position); return g / (nodes.length - 1); }
export function detectConvergenceDiscontinuity(gradient: number): boolean { return gradient > 5; }
export function detectRecursiveConvergenceBreak(nodes: readonly ManifoldNode[]): boolean { return nodes.some((n) => n.neighbors.includes(n.id) && Math.abs(n.tension) > 5); }
export function calculateConvergenceContinuity(nodes: readonly ManifoldNode[]): ConvergenceContinuityResult {
  const gradient = calculateContinuityGradient(nodes);
  const discontinuous = detectConvergenceDiscontinuity(gradient);
  const recursiveBreak = detectRecursiveConvergenceBreak(nodes);
  return Object.freeze({ continuous: !discontinuous && !recursiveBreak, discontinuous, recursiveBreak, gradient });
}
