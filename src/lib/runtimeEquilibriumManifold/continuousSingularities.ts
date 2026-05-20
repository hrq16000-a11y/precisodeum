import type { ContinuumSingularity, ManifoldNode, RuntimeContinuumSingularity } from './manifoldTypes';
export function calculateSingularitySpread(nodes: readonly ManifoldNode[]): number { return nodes.reduce((m, n) => Math.max(m, Math.abs(n.tension) + Math.abs(n.position)), 0); }
export function detectRecursiveSingularity(nodes: readonly ManifoldNode[]): boolean { return nodes.some((n) => n.neighbors.includes(n.id)); }
export function detectTerminalContinuumSingularity(spread: number): boolean { return spread >= 18; }
export function detectContinuousSingularity(nodes: readonly ManifoldNode[]): RuntimeContinuumSingularity {
  const spread = calculateSingularitySpread(nodes);
  const recursive = detectRecursiveSingularity(nodes);
  const terminal = detectTerminalContinuumSingularity(spread);
  let cls: ContinuumSingularity = 'NONE';
  if (terminal) cls = 'TERMINAL'; else if (recursive) cls = 'RECURSIVE'; else if (spread >= 10) cls = 'DISTRIBUTED'; else if (spread >= 3) cls = 'LOCAL';
  return Object.freeze({ class: cls, spread, recursive, terminal });
}
