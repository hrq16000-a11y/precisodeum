/**
 * Phase 1.9.47 — Rollout runtime (simulation only).
 */
import { signObject } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { SANDBOX_ROLLOUT_STAGES, type SponsorSandboxRolloutStage } from './sponsorSandboxInternals';
import { simulateConstraintEvaluation, type SandboxConstraintEvaluation } from './sponsorSandboxConstraintEngine';
import { thresholdForStage } from './sponsorSandboxSafetyGuards';

export interface SandboxRolloutStageResult {
  readonly index: number;
  readonly stage: SponsorSandboxRolloutStage;
  readonly evaluation: SandboxConstraintEvaluation;
  readonly stageSignature: string;
}

export interface SandboxRolloutSimulation {
  readonly version: 'v1';
  readonly stages: ReadonlyArray<SandboxRolloutStageResult>;
  readonly simulationSignature: string;
}

export function simulateRolloutStage(
  stage: SponsorSandboxRolloutStage,
  index = 0,
): SandboxRolloutStageResult {
  const t = thresholdForStage(stage);
  const evaluation = simulateConstraintEvaluation({
    stage,
    requestedExposurePct: t.maxExposurePct,
    requestedConcurrentActivations: t.maxConcurrentActivations,
  });
  return Object.freeze({
    index,
    stage,
    evaluation,
    stageSignature: signObject({ index, stage, sig: evaluation.evaluationSignature }),
  });
}

export function simulateFullRollout(): SandboxRolloutSimulation {
  const stages = SANDBOX_ROLLOUT_STAGES.map((s, i) => simulateRolloutStage(s, i));
  return Object.freeze({
    version: 'v1' as const,
    stages: Object.freeze(stages),
    simulationSignature: signObject(stages.map((s) => s.stageSignature)),
  });
}
