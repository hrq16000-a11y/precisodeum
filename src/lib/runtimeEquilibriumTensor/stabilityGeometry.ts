import type { RuntimeStabilityGeometry, TensorNode } from './tensorTypes';
export function calculateGeometricPressure(nodes: readonly TensorNode[]): number { if (nodes.length === 0) return 0; const s = nodes.reduce((a, n) => a + Math.abs(n.pressure), 0); return s / nodes.length; }
export function calculateGeometricBalance(nodes: readonly TensorNode[]): number { if (nodes.length === 0) return 1; const mean = nodes.reduce((a, n) => a + n.pressure, 0) / nodes.length; const v = nodes.reduce((a, n) => a + (n.pressure - mean) ** 2, 0) / nodes.length; return 1 / (1 + v); }
export function detectGeometryCollapse(nodes: readonly TensorNode[]): boolean { if (nodes.length === 0) return false; return nodes.every((n) => Math.abs(n.pressure) >= 8); }
export function buildStabilityGeometry(nodesIn: readonly TensorNode[]): RuntimeStabilityGeometry {
  const nodes = Object.freeze([...nodesIn].sort((a, b) => a.id.localeCompare(b.id)));
  const pressure = calculateGeometricPressure(nodes);
  const balance = calculateGeometricBalance(nodes);
  const collapsed = detectGeometryCollapse(nodes);
  const signature = `geom:${nodes.length}:${pressure.toFixed(3)}:${balance.toFixed(3)}:${collapsed ? '1' : '0'}`;
  return Object.freeze({ nodes, pressure, balance, collapsed, signature });
}
