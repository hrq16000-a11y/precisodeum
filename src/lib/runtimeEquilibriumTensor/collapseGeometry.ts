import type { RuntimeCollapseGeometry, RuntimeStabilityGeometry, RuntimeTopologyGeometry } from './tensorTypes';
export function calculateCollapseContainment(geom: RuntimeStabilityGeometry): number { return geom.collapsed ? 0 : geom.balance; }
export function detectGeometricCollapse(geom: RuntimeStabilityGeometry, topo: RuntimeTopologyGeometry): boolean { return geom.collapsed || topo.collapsing; }
export function detectCascadeCollapseGeometry(geom: RuntimeStabilityGeometry, topo: RuntimeTopologyGeometry): boolean { return geom.collapsed && topo.collapsing; }
export function buildCollapseGeometry(geom: RuntimeStabilityGeometry, topo: RuntimeTopologyGeometry): RuntimeCollapseGeometry {
  const collapsing = detectGeometricCollapse(geom, topo);
  const cascade = detectCascadeCollapseGeometry(geom, topo);
  const containment = calculateCollapseContainment(geom);
  return Object.freeze({ collapsing, cascade, containment });
}
