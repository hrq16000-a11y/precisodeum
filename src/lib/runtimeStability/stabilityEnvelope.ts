/**
 * Fase 1.8.4 — Stability envelope (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  RuntimeCollapsePoint,
  RuntimeConvergenceState,
  RuntimeDependencyResolution,
  RuntimeIsolationBoundary,
  RuntimePropagationEnvelope,
  RuntimeStabilityEnvelope,
  RuntimeStabilityWindow,
  StabilityClassification,
} from './stabilityTypes';

export interface BuildStabilityEnvelopeInput {
  readonly flow: FlowId;
  readonly resolution: RuntimeDependencyResolution;
  readonly collapse: readonly RuntimeCollapsePoint[];
  readonly propagation: readonly RuntimePropagationEnvelope[];
  readonly isolation: RuntimeIsolationBoundary;
  readonly convergence: RuntimeConvergenceState;
  readonly window: RuntimeStabilityWindow;
}

export function calculateStabilityScore(
  input: BuildStabilityEnvelopeInput,
): number {
  let score = 1;
  if (input.resolution.resolution === 'partially_resolved') score -= 0.2;
  if (input.resolution.resolution === 'unresolved') score -= 0.4;
  if (input.resolution.resolution === 'hidden') score -= 0.25;
  if (input.resolution.resolution === 'circular') score -= 0.5;
  const worst = input.collapse.reduce<number>((acc, c) => {
    const map = { none: 0, low: 0.05, medium: 0.15, high: 0.3, critical: 0.5 };
    return Math.max(acc, map[c.severity]);
  }, 0);
  score -= worst;
  if (input.propagation.some((p) => p.overflow)) score -= 0.15;
  if (input.propagation.some((p) => p.boundaryLeak)) score -= 0.15;
  if (!input.isolation.intact) score -= 0.15;
  if (input.convergence.divergent) score -= 0.3;
  if (input.convergence.regressed) score -= 0.1;
  if (score < 0) score = 0;
  if (score > 1) score = 1;
  return Math.round(score * 100) / 100;
}

export function classifyStabilityEnvelope(input: {
  score: number;
  divergent: boolean;
  collapsing: boolean;
  converging: boolean;
}): StabilityClassification {
  if (input.divergent) return 'divergent';
  if (input.collapsing) return 'collapsing';
  if (input.score >= 0.85) return 'stable';
  if (input.converging) return 'converging';
  return 'unstable';
}

export function detectEnvelopeInstability(
  e: RuntimeStabilityEnvelope,
): boolean {
  return e.classification === 'unstable' || e.classification === 'collapsing';
}

export function detectPropagationLeak(
  envelopes: readonly RuntimePropagationEnvelope[],
): boolean {
  return envelopes.some((e) => e.boundaryLeak || e.overflow);
}

export function detectIsolationFailure(
  iso: RuntimeIsolationBoundary,
): boolean {
  return !iso.intact || iso.leakedTo.length > 0;
}

export function detectConvergenceRegression(
  c: RuntimeConvergenceState,
): boolean {
  return c.regressed || c.divergent;
}

export function buildStabilityEnvelope(
  input: BuildStabilityEnvelopeInput,
): RuntimeStabilityEnvelope {
  const score = calculateStabilityScore(input);
  const collapsing = input.collapse.some(
    (c) => c.severity === 'high' || c.severity === 'critical',
  );
  const classification = classifyStabilityEnvelope({
    score,
    divergent: input.convergence.divergent,
    collapsing,
    converging: input.convergence.mode === 'eventual' && !input.convergence.regressed,
  });
  return {
    flow: input.flow,
    classification,
    score,
    resolution: input.resolution,
    collapse: input.collapse,
    propagation: input.propagation,
    isolation: input.isolation,
    convergence: input.convergence,
    window: input.window,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    currentStage: 'STAGE_0_READ_ONLY',
  };
}
