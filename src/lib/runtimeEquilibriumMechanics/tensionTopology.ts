/**
 * Fase 1.9.3 — Topology Tension (READ-ONLY, pure).
 */
import type { EquilibriumNode, RuntimeTopologyTension, TopologyTension } from './equilibriumTypes';

export function buildTopologyTension(nodes: readonly EquilibriumNode[]): RuntimeTopologyTension {
  const edges = nodes.reduce((a, n) => a + n.neighbors.length, 0);
  const stressed = detectTopologyStress(nodes);
  const fractured = detectFracturedTopology(nodes);
  const collapsing = detectCollapsingTopology(nodes);
  const balance = calculateTopologyBalance(nodes);
  let tension: TopologyTension = 'RELAXED';
  if (collapsing) tension = 'COLLAPSING';
  else if (fractured) tension = 'FRACTURED';
  else if (stressed) tension = 'STRESSED';
  else if (edges > 0) tension = 'BALANCED';
  return Object.freeze({ tension, nodes: nodes.length, edges, stressed, fractured, collapsing, balance });
}

export function detectTopologyStress(nodes: readonly EquilibriumNode[]): boolean {
  if (nodes.length === 0) return false;
  const stressed = nodes.filter((n) => Math.abs(n.tension) >= 5).length;
  return stressed / nodes.length >= 0.3;
}

export function detectFracturedTopology(nodes: readonly EquilibriumNode[]): boolean {
  if (nodes.length === 0) return false;
  const ids = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, n.neighbors.filter((x) => ids.has(x)));
  // BFS fragment count
  const visited = new Set<string>();
  let comps = 0;
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    comps++;
    const stack = [n.id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const nb of adj.get(cur) ?? []) stack.push(nb);
    }
  }
  return comps > 1 && nodes.length >= 2;
}

export function detectCollapsingTopology(nodes: readonly EquilibriumNode[]): boolean {
  if (nodes.length === 0) return false;
  const collapsing = nodes.filter((n) => n.tension >= 9 && n.potential <= -9).length;
  return collapsing / nodes.length >= 0.5;
}

export function calculateTopologyBalance(nodes: readonly EquilibriumNode[]): number {
  if (nodes.length === 0) return 1;
  const totalT = nodes.reduce((a, n) => a + Math.abs(n.tension), 0);
  return Math.max(0, 1 - Math.min(1, totalT / (nodes.length * 10)));
}
