import type { GeodesicPropagation, ManifoldNode, RuntimePropagationGeodesic } from './manifoldTypes';
export function calculateGeodesicContainment(nodes: readonly ManifoldNode[]): number { if (nodes.length === 0) return 1; const avg = nodes.reduce((a, n) => a + n.neighbors.length, 0) / nodes.length; return 1 / (1 + avg / 5); }
export function detectRecursiveGeodesics(nodes: readonly ManifoldNode[]): boolean { return nodes.some((n) => n.neighbors.includes(n.id)); }
export function detectInfiniteGeodesics(nodes: readonly ManifoldNode[]): boolean { const ids = new Set(nodes.map((n) => n.id)); return nodes.some((n) => n.neighbors.some((nb) => !ids.has(nb)) && n.neighbors.length > 4); }
export function calculatePropagationGeodesics(nodes: readonly ManifoldNode[]): RuntimePropagationGeodesic {
  const length = nodes.reduce((a, n) => a + n.neighbors.length, 0);
  const recursive = detectRecursiveGeodesics(nodes);
  const infinite = detectInfiniteGeodesics(nodes);
  const containment = calculateGeodesicContainment(nodes);
  let prop: GeodesicPropagation = 'MINIMAL';
  if (infinite) prop = 'INFINITE'; else if (recursive) prop = 'ESCALATING'; else if (length > nodes.length * 3) prop = 'DISTRIBUTED'; else if (length > 0) prop = 'CONTAINED';
  return Object.freeze({ propagation: prop, length, containment, recursive, infinite });
}
