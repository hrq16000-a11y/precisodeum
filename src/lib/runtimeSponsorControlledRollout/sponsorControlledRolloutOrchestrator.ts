/**
 * SponsorControlledRolloutOrchestrator — orquestrador terminal.
 * 100% read-only, determinístico, fail-closed.
 */
import { SPONSOR_ROLLOUT_INTERNALS } from './sponsorRolloutInternals';
import { buildRolloutEnvelope, type RolloutEnvelope } from './sponsorRolloutEnvelope';
import { buildExposurePlan, type ExposurePlan } from './sponsorRolloutExposureCoordinator';
import { validateResume, type ResumeValidation } from './sponsorRolloutResumeValidator';
import { ROLLOUT_FREEZE_CONSTRAINTS } from './sponsorRolloutFreezeConstraints';
import type { RolloutStage } from './sponsorRolloutOrchestrationRuntime';

export interface ControlledRolloutCertification {
  readonly envelope: RolloutEnvelope;
  readonly exposurePlan: ExposurePlan;
  readonly freezeConstraints: typeof ROLLOUT_FREEZE_CONSTRAINTS;
  readonly rolloutAuthorized: false;
  readonly mode: 'DETERMINISTIC_SIMULATION_ONLY';
}

export function certifyControlledRollout(): ControlledRolloutCertification {
  if (SPONSOR_ROLLOUT_INTERNALS.realRolloutAllowed) {
    throw new Error('REAL_ROLLOUT_FORBIDDEN');
  }
  return Object.freeze({
    envelope: buildRolloutEnvelope(),
    exposurePlan: buildExposurePlan(),
    freezeConstraints: ROLLOUT_FREEZE_CONSTRAINTS,
    rolloutAuthorized: false,
    mode: 'DETERMINISTIC_SIMULATION_ONLY',
  });
}

export function certifyResume(stage: RolloutStage): ResumeValidation {
  return validateResume(stage);
}
