/**
 * Phase 1.9.47 — Sandbox execution limits (read-only).
 */
export const SPONSOR_SANDBOX_EXECUTION_LIMITS = Object.freeze({
  maxSimulatedSteps: 1024,
  maxSimulatedDurationMs: 60_000,
  maxSimulatedActivationsPerStage: 10_000,
  maxSimulatedFailures: 256,
});
