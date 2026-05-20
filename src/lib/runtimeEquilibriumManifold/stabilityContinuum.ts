import type { ManifoldNode, RuntimeStabilityContinuum } from './manifoldTypes';
export function calculateContinuumPressure(nodes: readonly ManifoldNode[]): number { if (nodes.length === 0) return 0; return nodes.reduce((a, n) => a + Math.abs(n.tension), 0) / nodes.length; }
export function calculateContinuumBalance(nodes: readonly ManifoldNode[]): number { if (nodes.length === 0) return 1; const mean = nodes.reduce((a, n) => a + n.position, 0) / nodes.length; const v = nodes.reduce((a, n) => a + (n.position - mean) ** 2, 0) / nodes.length; return 1 / (1 + v); }
export function detectContinuumCollapse(nodes: readonly ManifoldNode[]): boolean { if (nodes.length === 0) return false; return nodes.every((n) => Math.abs(n.tension) >= 8); }
export function buildStabilityContinuum(nodesIn: readonly ManifoldNode[]): RuntimeStabilityContinuum {
  const nodes = Object.freeze([...nodesIn].sort((a, b) => a.id.localeCompare(b.id)));
  const pressure = calculateContinuumPressure(nodes);
  const balance = calculateContinuumBalance(nodes);
  const collapsed = detectContinuumCollapse(nodes);
  const signature = `cont:${nodes.length}:${pressure.toFixed(3)}:${balance.toFixed(3)}:${collapsed ? '1' : '0'}`;
  return Object.freeze({ nodes, pressure, balance, collapsed, signature });
}
