/**
 * Phase 1.9.47 — Sandbox execution runtime.
 */
import { signObject, deepFreeze } from '@/lib/runtimeSponsorMetaPlaneRuntime';
import { simulateFullRollout, type SandboxRolloutSimulation } from './sponsorSandboxRolloutRuntime';
import { simulateExposureEscalation, type SandboxExposureSimulation } from './sponsorSandboxExposureSimulator';
import { assertNoRealSideEffects } from './sponsorSandboxSafetyGuards';

export interface SandboxActivationFlowResult {
  readonly version: 'v1';
  readonly rollout: SandboxRolloutSimulation;
  readonly exposure: SandboxExposureSimulation;
  readonly flowSignature: string;
}

export function simulateActivationFlow(): SandboxActivationFlowResult {
  assertNoRealSideEffects();
  const rollout = simulateFullRollout();
  const exposure = simulateExposureEscalation();
  return deepFreeze({
    version: 'v1' as const,
    rollout,
    exposure,
    flowSignature: signObject({
      rollout: rollout.simulationSignature,
      exposure: exposure.simulationSignature,
    }),
  });
}
