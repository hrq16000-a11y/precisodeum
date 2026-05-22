/**
 * Phase 1.9.47 — Sandbox safety thresholds (read-only).
 */
import type { SponsorSandboxRolloutStage } from './sponsorSandboxInternals';

export interface SponsorSandboxThreshold {
  readonly stage: SponsorSandboxRolloutStage;
  readonly maxExposurePct: number;
  readonly maxConcurrentActivations: number;
  readonly maxErrorRatePct: number;
}

export const SPONSOR_SANDBOX_THRESHOLDS: ReadonlyArray<SponsorSandboxThreshold> = Object.freeze([
  Object.freeze({ stage: 'dark_launch', maxExposurePct: 0, maxConcurrentActivations: 0, maxErrorRatePct: 0 }),
  Object.freeze({ stage: 'internal_only', maxExposurePct: 0.1, maxConcurrentActivations: 5, maxErrorRatePct: 0 }),
  Object.freeze({ stage: 'canary_1pct', maxExposurePct: 1, maxConcurrentActivations: 25, maxErrorRatePct: 0.5 }),
  Object.freeze({ stage: 'canary_5pct', maxExposurePct: 5, maxConcurrentActivations: 100, maxErrorRatePct: 1 }),
  Object.freeze({ stage: 'beta_25pct', maxExposurePct: 25, maxConcurrentActivations: 500, maxErrorRatePct: 2 }),
  Object.freeze({ stage: 'beta_50pct', maxExposurePct: 50, maxConcurrentActivations: 1000, maxErrorRatePct: 2 }),
  Object.freeze({ stage: 'general_availability', maxExposurePct: 100, maxConcurrentActivations: 10000, maxErrorRatePct: 3 }),
]);
