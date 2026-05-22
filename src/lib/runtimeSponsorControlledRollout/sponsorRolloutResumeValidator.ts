/**
 * Rollout Resume Validator — valida resumes determinísticos.
 */
import { buildPauseTopology } from './sponsorRolloutPauseTopology';
import type { RolloutStage } from './sponsorRolloutOrchestrationRuntime';

export interface ResumeValidation {
  readonly stage: RolloutStage;
  readonly canResume: boolean;
  readonly reason: string;
}

export function validateResume(stage: RolloutStage): ResumeValidation {
  const node = buildPauseTopology().find((n) => n.stage === stage);
  if (!node) {
    return Object.freeze({
      stage,
      canResume: false,
      reason: 'UNKNOWN_STAGE',
    });
  }
  return Object.freeze({
    stage,
    canResume: node.resumable,
    reason: node.resumable ? 'DETERMINISTIC_RESUME_ELIGIBLE' : 'RESUME_BLOCKED',
  });
}
