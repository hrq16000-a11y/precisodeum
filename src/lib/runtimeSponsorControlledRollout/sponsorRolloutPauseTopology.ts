/**
 * Rollout Pause Topology — topologia de pontos de pausa elegíveis.
 */
import { ROLLOUT_STAGE_ORDER, type RolloutStage } from './sponsorRolloutOrchestrationRuntime';

export interface PauseNode {
  readonly stage: RolloutStage;
  readonly pausable: boolean;
  readonly resumable: boolean;
}

export function buildPauseTopology(): readonly PauseNode[] {
  return Object.freeze(
    ROLLOUT_STAGE_ORDER.map((stage) =>
      Object.freeze({ stage, pausable: true, resumable: true }),
    ),
  );
}
