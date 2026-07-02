/**
 * Fase 1.8.1 — Runtime trend analysis (READ-ONLY).
 */

import type { RuntimeHistoryWindow, RuntimeTrendDirection } from './runtimeHistoryTypes';

const SEV = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;

export function detectTrendDegradation(window: RuntimeHistoryWindow): boolean {
  if (window.entries.length < 4) return false;
  const sev = window.entries.map((e) => SEV[e.severity]);
  const mid = Math.floor(sev.length / 2);
  const avg = (xs: number[]) => xs.reduce((s, n) => s + n, 0) / xs.length;
  return avg(sev.slice(mid)) > avg(sev.slice(0, mid)) + 0.5;
}

export function detectStabilityRecovery(window: RuntimeHistoryWindow): boolean {
  if (window.entries.length < 4) return false;
  const sev = window.entries.map((e) => SEV[e.severity]);
  const mid = Math.floor(sev.length / 2);
  const avg = (xs: number[]) => xs.reduce((s, n) => s + n, 0) / xs.length;
  return avg(sev.slice(0, mid)) - avg(sev.slice(mid)) > 0.5;
}

export function detectEscalatingFailures(window: RuntimeHistoryWindow): boolean {
  if (window.entries.length < 3) return false;
  let streak = 0;
  let maxStreak = 0;
  for (const e of window.entries) {
    const isFailure =
      e.consistency === 'inconsistent' ||
      e.consistency === 'orphaned' ||
      e.consistency === 'partial' ||
      e.classification === 'CRITICAL' ||
      SEV[e.severity] >= SEV.HIGH;
    if (isFailure) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }
  return maxStreak >= 3;
}

export function calculateRuntimeHealthTrend(window: RuntimeHistoryWindow): RuntimeTrendDirection {
  if (window.entries.length < 2) return 'unknown';
  if (detectEscalatingFailures(window)) return 'degrading';
  if (detectStabilityRecovery(window)) return 'improving';
  if (detectTrendDegradation(window)) return 'degrading';
  return 'stable';
}
