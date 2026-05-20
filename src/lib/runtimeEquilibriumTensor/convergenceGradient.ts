import type { RuntimeConvergenceGradient, TensorNode } from './tensorTypes';
export function calculateGradientEquilibrium(nodes: readonly TensorNode[]): number { if (nodes.length < 2) return 1; const diffs: number[] = []; for (let i = 1; i < nodes.length; i++) diffs.push(Math.abs(nodes[i].pressure - nodes[i - 1].pressure)); const avg = diffs.reduce((a, v) => a + v, 0) / diffs.length; return 1 / (1 + avg); }
export function detectReverseGradient(nodes: readonly TensorNode[]): boolean { if (nodes.length < 2) return false; let neg = 0; for (let i = 1; i < nodes.length; i++) if (nodes[i].pressure < nodes[i - 1].pressure) neg++; return neg > nodes.length / 2; }
export function detectGradientInstability(value: number): boolean { return Math.abs(value) > 5; }
export function calculateConvergenceGradient(nodes: readonly TensorNode[]): RuntimeConvergenceGradient {
  const value = nodes.length === 0 ? 0 : (nodes[nodes.length - 1].pressure - nodes[0].pressure);
  const reversed = detectReverseGradient(nodes);
  const unstable = detectGradientInstability(value);
  const equilibrium = calculateGradientEquilibrium(nodes);
  return Object.freeze({ value, reversed, unstable, equilibrium });
}
