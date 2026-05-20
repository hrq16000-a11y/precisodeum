import type { RuntimeTopologyGeometry, TensorNode, TopologyDeformation } from './tensorTypes';
export function calculateTopologyStress(nodes: readonly TensorNode[]): number { if (nodes.length === 0) return 0; return nodes.reduce((a, n) => a + Math.abs(n.pressure) + Math.abs(n.curvature) + Math.abs(n.density), 0) / (nodes.length * 30); }
export function detectTopologyFracture(nodes: readonly TensorNode[]): boolean { const ids = new Set(nodes.map((n) => n.id)); const orphans = nodes.filter((n) => n.neighbors.length === 0 || n.neighbors.every((nb) => !ids.has(nb))); return orphans.length > 0 && orphans.length < nodes.length; }
export function detectTopologyCollapse(nodes: readonly TensorNode[]): boolean { if (nodes.length === 0) return false; return nodes.every((n) => Math.abs(n.pressure) >= 8 && Math.abs(n.curvature) >= 8); }
export function buildTopologyDeformation(nodes: readonly TensorNode[]): RuntimeTopologyGeometry {
  const stress = calculateTopologyStress(nodes);
  const fractured = detectTopologyFracture(nodes);
  const collapsing = detectTopologyCollapse(nodes);
  let deformation: TopologyDeformation = 'NONE';
  if (collapsing) deformation = 'COLLAPSING'; else if (fractured) deformation = 'FRACTURED'; else if (stress > 0.5) deformation = 'DISTRIBUTED'; else if (stress > 0.1) deformation = 'LOCAL';
  return Object.freeze({ deformation, stress, fractured, collapsing });
}
