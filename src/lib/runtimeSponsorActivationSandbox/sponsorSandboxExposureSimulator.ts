/**
 * Phase 1.9.47 — Exposure escalation simulator.
 */
import { signObject } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { SANDBOX_ROLLOUT_STAGES, type SponsorSandboxRolloutStage } from './sponsorSandboxInternals';
import { thresholdForStage } from './sponsorSandboxSafetyGuards';

export interface SandboxExposureStep {
  readonly stage: SponsorSandboxRolloutStage;
  readonly exposurePct: number;
  readonly admitted: boolean;
  readonly stepSignature: string;
}

export interface SandboxExposureSimulation {
  readonly version: 'v1';
  readonly steps: ReadonlyArray<SandboxExposureStep>;
  readonly simulationSignature: string;
}

export function simulateExposureEscalation(
  startingStage: SponsorSandboxRolloutStage = 'dark_launch',
): SandboxExposureSimulation {
  const startIndex = SANDBOX_ROLLOUT_STAGES.indexOf(startingStage);
  const steps: SandboxExposureStep[] = [];
  for (let i = startIndex; i < SANDBOX_ROLLOUT_STAGES.length; i++) {
    const stage = SANDBOX_ROLLOUT_STAGES[i];
    const t = thresholdForStage(stage);
    const payload = { stage, exposurePct: t.maxExposurePct, admitted: true };
    steps.push(Object.freeze({ ...payload, stepSignature: signObject(payload) }));
  }
  return Object.freeze({
    version: 'v1' as const,
    steps: Object.freeze(steps),
    simulationSignature: signObject(steps.map((s) => s.stepSignature)),
  });
}
