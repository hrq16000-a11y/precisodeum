/**
 * Fase 1.8.2 — Replay aggregation (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  ReplayClassification,
  ReplayRisk,
  ReplaySeverity,
  RuntimeReplay,
} from './replayTypes';

const SEV_RANK: Record<ReplaySeverity, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};
const RISK_RANK: Record<ReplayRisk, number> = {
  none: 0, low: 1, medium: 2, high: 3, critical: 4,
};

export interface ReplayHealth {
  readonly totalFlows: number;
  readonly deterministic: number;
  readonly partial: number;
  readonly unstable: number;
  readonly divergent: number;
  readonly unreconstructable: number;
  readonly worstRisk: ReplayRisk;
  readonly worstSeverity: ReplaySeverity;
  readonly avgConfidence: number;
}

export function aggregateReplayHealth(replays: readonly RuntimeReplay[]): ReplayHealth {
  const counts: Record<ReplayClassification, number> = {
    deterministic: 0,
    partially_deterministic: 0,
    unstable: 0,
    divergent: 0,
    unreconstructable: 0,
  };
  let worstRisk: ReplayRisk = 'none';
  let worstSev: ReplaySeverity = 'NONE';
  let confSum = 0;
  for (const r of replays) {
    counts[r.classification]++;
    if (RISK_RANK[r.risk] > RISK_RANK[worstRisk]) worstRisk = r.risk;
    if (SEV_RANK[r.severity] > SEV_RANK[worstSev]) worstSev = r.severity;
    confSum += r.determinism.confidenceScore;
  }
  return {
    totalFlows: replays.length,
    deterministic: counts.deterministic,
    partial: counts.partially_deterministic,
    unstable: counts.unstable,
    divergent: counts.divergent,
    unreconstructable: counts.unreconstructable,
    worstRisk,
    worstSeverity: worstSev,
    avgConfidence: replays.length ? Number((confSum / replays.length).toFixed(3)) : 0,
  };
}

export function summarizeReplayRisk(replays: readonly RuntimeReplay[]): Record<ReplayRisk, number> {
  const out: Record<ReplayRisk, number> = { none: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const r of replays) out[r.risk]++;
  return out;
}

export interface ReplayInstabilityRanking {
  readonly flow: FlowId;
  readonly score: number; // higher = more unstable
}

export function rankReplayInstability(replays: readonly RuntimeReplay[]): ReplayInstabilityRanking[] {
  return replays
    .map((r) => {
      let s = 0;
      if (r.classification === 'unreconstructable') s += 100;
      else if (r.classification === 'divergent') s += 75;
      else if (r.classification === 'unstable') s += 50;
      else if (r.classification === 'partially_deterministic') s += 20;
      s += r.parity.gap;
      s += RISK_RANK[r.risk] * 10;
      s += SEV_RANK[r.severity] * 5;
      return { flow: r.flow, score: Number(s.toFixed(2)) };
    })
    .sort((a, b) => b.score - a.score);
}

export function summarizeReplayDeterminism(replays: readonly RuntimeReplay[]) {
  const total = replays.length || 1;
  const det = replays.filter((r) => r.classification === 'deterministic').length;
  const part = replays.filter((r) => r.classification === 'partially_deterministic').length;
  return {
    totalFlows: replays.length,
    deterministicRatio: Number((det / total).toFixed(3)),
    partialRatio: Number((part / total).toFixed(3)),
  };
}

export interface ReplayOperationalHealth {
  readonly totalFlows: number;
  readonly healthy: number;
  readonly degraded: number;
  readonly critical: number;
  readonly worstRisk: ReplayRisk;
}

export function buildReplayOperationalHealth(
  replays: readonly RuntimeReplay[],
): ReplayOperationalHealth {
  let healthy = 0, degraded = 0, critical = 0;
  let worstRisk: ReplayRisk = 'none';
  for (const r of replays) {
    if (r.risk === 'critical' || r.classification === 'unreconstructable') critical++;
    else if (r.risk === 'high' || r.risk === 'medium') degraded++;
    else healthy++;
    if (RISK_RANK[r.risk] > RISK_RANK[worstRisk]) worstRisk = r.risk;
  }
  return { totalFlows: replays.length, healthy, degraded, critical, worstRisk };
}
