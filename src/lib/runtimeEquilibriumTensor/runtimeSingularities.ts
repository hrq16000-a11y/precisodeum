import type { RuntimeSingularityEnvelope, SingularityClass, TensorNode } from './tensorTypes';
export function calculateSingularityRadius(nodes: readonly TensorNode[]): number { return nodes.reduce((m, n) => Math.max(m, Math.abs(n.pressure) + Math.abs(n.curvature) + Math.abs(n.density)), 0); }
export function detectRecursiveSingularity(nodes: readonly TensorNode[]): boolean { return nodes.some((n) => n.neighbors.includes(n.id)); }
export function detectTerminalSingularity(radius: number): boolean { return radius >= 25; }
export function detectRuntimeSingularity(nodes: readonly TensorNode[]): RuntimeSingularityEnvelope {
  const radius = calculateSingularityRadius(nodes);
  const recursive = detectRecursiveSingularity(nodes);
  const terminal = detectTerminalSingularity(radius);
  let cls: SingularityClass = 'NONE';
  if (terminal) cls = 'TERMINAL'; else if (recursive) cls = 'RECURSIVE'; else if (radius >= 15) cls = 'PROPAGATING'; else if (radius >= 5) cls = 'LOCALIZED';
  return Object.freeze({ class: cls, radius, recursive, terminal });
}
