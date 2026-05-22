/**
 * Rollout Convergence Engine — simula convergência determinística do rollout.
 */
import { ROLLOUT_STAGE_ORDER, type RolloutStage } from './sponsorRolloutOrchestrationRuntime';

export interface ConvergenceState {
  readonly stage: RolloutStage;
  readonly converged: boolean;
  readonly halted: boolean;
  readonly reason: string;
}

export function simulateRolloutConvergence(): readonly ConvergenceState[] {
  const out: ConvergenceState[] = ROLLOUT_STAGE_ORDER.map((stage) =>
    Object.freeze({
      stage,
      converged: true,
      halted: false,
      reason: 'DETERMINISTIC_SIMULATED_CONVERGENCE',
    }),
  );
  return Object.freeze(out);
}

export function assertConvergenceStable(
  a: readonly ConvergenceState[],
  b: readonly ConvergenceState[],
): void {
  if (a.length !== b.length) throw new Error('CONVERGENCE_LENGTH_DRIFT');
  for (let i = 0; i < a.length; i++) {
    if (a[i].stage !== b[i].stage || a[i].converged !== b[i].converged) {
      throw new Error('CONVERGENCE_STATE_DRIFT');
    }
  }
}
