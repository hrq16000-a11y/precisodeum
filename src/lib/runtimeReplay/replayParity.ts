/**
 * Fase 1.8.2 — Replay parity (READ-ONLY).
 *
 * Compara replay reconstruído contra runtimeHistory, runtimeRecorder,
 * atomicSimulation e runtimeCertification. Apenas leitura.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import { calculateRuntimeParityGap } from '@/lib/runtimeRecorder/runtimeComparison';
import { simulateFlow } from '@/lib/atomicSimulation/simulateAtomicExecution';
import { buildRuntimeCertification } from '@/lib/runtimeCertification/certificationMatrix';
import type { ReplayParity, RuntimeReplay } from './replayTypes';
import { buildReplayParity as builderParity } from './replayBuilder';

export function buildReplayParity(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReplayParity {
  return builderParity(flow, traces);
}

export function calculateReplayParityScore(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): number {
  const flowTraces = traces.filter((t) => t.flow === flow);
  if (flowTraces.length === 0) return 0;
  const gaps = flowTraces.map((t) => calculateRuntimeParityGap(t).gap);
  const avg = gaps.reduce((s, n) => s + n, 0) / gaps.length;
  return Number(Math.max(0, 100 - avg).toFixed(2));
}

export function detectReplayParityRegression(replay: RuntimeReplay): boolean {
  return replay.parity.regression || replay.parity.gap > 30;
}

export function detectReplayRollbackMismatch(replay: RuntimeReplay): boolean {
  if (replay.parity.rollbackMismatch) return true;
  const cert = buildRuntimeCertification(replay.flow);
  if (!cert) return false;
  return cert.rollback.rollback === 'incompatible' && replay.classification !== 'unreconstructable';
}

export function detectReplayVisibilityGap(replay: RuntimeReplay): boolean {
  if (replay.parity.visibilityGap) return true;
  const sim = simulateFlow(replay.flow);
  if (!sim) return false;
  const expected = sim.legacy.steps.length;
  const observedDistinct = new Set(replay.window.steps.map((s) => s.step)).size;
  return observedDistinct < expected;
}
