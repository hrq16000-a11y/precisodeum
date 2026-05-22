/**
 * Rollout Convergence Graph — grafo de convergência simulada.
 */
import { simulateRolloutConvergence } from './sponsorRolloutConvergenceEngine';

export interface ConvergenceGraphNode {
  readonly stage: string;
  readonly converged: boolean;
  readonly halted: boolean;
}

export function buildConvergenceGraph(): readonly ConvergenceGraphNode[] {
  const states = simulateRolloutConvergence();
  return Object.freeze(
    states.map((s) =>
      Object.freeze({ stage: s.stage, converged: s.converged, halted: s.halted }),
    ),
  );
}
