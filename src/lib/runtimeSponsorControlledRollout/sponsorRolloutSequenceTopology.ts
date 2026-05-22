/**
 * Rollout Sequence Topology — topologia linear canônica do rollout.
 */
import { ROLLOUT_STAGE_ORDER, type RolloutStage } from './sponsorRolloutOrchestrationRuntime';

export interface SequenceNode {
  readonly stage: RolloutStage;
  readonly position: number;
  readonly previous: RolloutStage | null;
  readonly next: RolloutStage | null;
}

export function buildSequenceTopology(): readonly SequenceNode[] {
  const out: SequenceNode[] = ROLLOUT_STAGE_ORDER.map((stage, i) =>
    Object.freeze({
      stage,
      position: i,
      previous: i > 0 ? ROLLOUT_STAGE_ORDER[i - 1] : null,
      next: i < ROLLOUT_STAGE_ORDER.length - 1 ? ROLLOUT_STAGE_ORDER[i + 1] : null,
    }),
  );
  return Object.freeze(out);
}
