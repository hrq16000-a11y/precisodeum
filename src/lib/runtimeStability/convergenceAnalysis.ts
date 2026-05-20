/**
 * Fase 1.8.4 — Convergence analysis (READ-ONLY, pure).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  ConvergenceMode,
  RuntimeConvergenceState,
  RuntimeDependencyResolution,
} from './stabilityTypes';

export interface ConvergenceAnalysisInput {
  readonly flow: FlowId;
  readonly resolution: RuntimeDependencyResolution;
  readonly delayMs: number;
  readonly priorMode?: ConvergenceMode;
  readonly hardDivergent?: boolean;
}

export function classifyConvergenceMode(input: {
  resolution: RuntimeDependencyResolution;
  delayMs: number;
  hardDivergent?: boolean;
}): ConvergenceMode {
  if (input.hardDivergent) return 'divergent';
  if (input.resolution.resolution === 'circular') return 'recursive';
  if (input.resolution.resolution === 'unresolved') return 'divergent';
  if (input.delayMs > 5000) return 'delayed';
  if (input.delayMs > 0) return 'eventual';
  return 'deterministic';
}

export function calculateConvergenceConfidence(input: {
  resolution: RuntimeDependencyResolution;
  delayMs: number;
}): number {
  let c = 1;
  if (input.resolution.resolution === 'partially_resolved') c -= 0.2;
  if (input.resolution.resolution === 'unresolved') c -= 0.5;
  if (input.resolution.resolution === 'hidden') c -= 0.2;
  if (input.resolution.resolution === 'circular') c -= 0.6;
  c -= Math.min(0.3, input.delayMs / 50000);
  if (c < 0) c = 0;
  return Math.round(c * 100) / 100;
}

export function detectConvergenceDelay(c: RuntimeConvergenceState): boolean {
  return c.mode === 'delayed' || c.delayMs > 5000;
}

export function detectConvergenceFailure(c: RuntimeConvergenceState): boolean {
  return c.divergent || c.confidence < 0.3;
}

export function detectDivergentConvergence(c: RuntimeConvergenceState): boolean {
  return c.mode === 'divergent';
}

export function analyzeRuntimeConvergence(input: ConvergenceAnalysisInput): RuntimeConvergenceState {
  const mode = classifyConvergenceMode({
    resolution: input.resolution,
    delayMs: input.delayMs,
    hardDivergent: input.hardDivergent,
  });
  const confidence = calculateConvergenceConfidence({
    resolution: input.resolution,
    delayMs: input.delayMs,
  });
  const regressed = input.priorMode
    ? regressionRank(mode) > regressionRank(input.priorMode)
    : false;
  return {
    flow: input.flow,
    mode,
    confidence,
    delayMs: input.delayMs,
    divergent: mode === 'divergent',
    regressed,
  };
}

function regressionRank(m: ConvergenceMode): number {
  return { deterministic: 0, eventual: 1, delayed: 2, recursive: 3, divergent: 4 }[m];
}
