import type { RuntimeContainmentField, TensorNode } from './tensorTypes';
export function calculateContainmentStrength(nodes: readonly TensorNode[]): number { if (nodes.length === 0) return 1; const pressure = nodes.reduce((a, n) => a + Math.abs(n.pressure) + Math.abs(n.curvature), 0) / nodes.length; return 1 / (1 + pressure / 5); }
export function detectContainmentLeak(nodes: readonly TensorNode[]): boolean { const ids = new Set(nodes.map((n) => n.id)); return nodes.some((n) => n.neighbors.some((nb) => !ids.has(nb))); }
function countComponents(nodes: readonly TensorNode[]): number { const adj = new Map<string, string[]>(); for (const n of nodes) adj.set(n.id, [...n.neighbors]); for (const [id, nb] of adj) for (const x of nb) { if (adj.has(x) && !adj.get(x)!.includes(id)) adj.get(x)!.push(id); } const seen = new Set<string>(); let c = 0; for (const id of adj.keys()) { if (seen.has(id)) continue; c++; const q = [id]; while (q.length) { const cur = q.shift()!; if (seen.has(cur)) continue; seen.add(cur); for (const nb of adj.get(cur) ?? []) if (adj.has(nb)) q.push(nb); } } return c; }
export function detectFieldFragmentation(nodes: readonly TensorNode[]): number { return countComponents(nodes); }
export function buildContainmentField(nodes: readonly TensorNode[]): RuntimeContainmentField {
  const strength = calculateContainmentStrength(nodes);
  const leaking = detectContainmentLeak(nodes);
  const fragments = detectFieldFragmentation(nodes);
  const fragmented = fragments > 1;
  return Object.freeze({ strength, leaking, fragmented, fragments });
}
