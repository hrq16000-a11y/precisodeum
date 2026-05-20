/**
 * Fase 1.8.4 — Stability aggregation (READ-ONLY, pure).
 */

import type {
  CollapseSeverity,
  RuntimeDependencyResolution,
  RuntimeResolutionSummary,
  RuntimeStabilityEnvelope,
  RuntimeStabilityHealth,
} from './stabilityTypes';

const SEV_RANK: Record<CollapseSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function fromRank(r: number): CollapseSeverity {
  const map: CollapseSeverity[] = ['none', 'low', 'medium', 'high', 'critical'];
  return map[Math.max(0, Math.min(4, r))];
}

export function aggregateStabilityHealth(
  envelopes: readonly RuntimeStabilityEnvelope[],
): RuntimeStabilityHealth {
  if (envelopes.length === 0) {
    return {
      flows: 0,
      stable: 0,
      converging: 0,
      unstable: 0,
      collapsing: 0,
      divergent: 0,
      averageScore: 0,
      worstCollapseSeverity: 'none',
    };
  }
  let stable = 0, converging = 0, unstable = 0, collapsing = 0, divergent = 0;
  let sum = 0;
  let worst = 0;
  for (const e of envelopes) {
    if (e.classification === 'stable') stable++;
    else if (e.classification === 'converging') converging++;
    else if (e.classification === 'unstable') unstable++;
    else if (e.classification === 'collapsing') collapsing++;
    else if (e.classification === 'divergent') divergent++;
    sum += e.score;
    for (const c of e.collapse) worst = Math.max(worst, SEV_RANK[c.severity]);
  }
  return {
    flows: envelopes.length,
    stable,
    converging,
    unstable,
    collapsing,
    divergent,
    averageScore: Math.round((sum / envelopes.length) * 100) / 100,
    worstCollapseSeverity: fromRank(worst),
  };
}

export function summarizeCollapseRisk(
  envelopes: readonly RuntimeStabilityEnvelope[],
): { flow: string; severity: CollapseSeverity; blast: number }[] {
  const out: { flow: string; severity: CollapseSeverity; blast: number }[] = [];
  for (const e of envelopes) {
    for (const c of e.collapse) {
      out.push({ flow: e.flow, severity: c.severity, blast: c.blastRadius });
    }
  }
  return out.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.blast - a.blast);
}

export function rankStabilityInstability(
  envelopes: readonly RuntimeStabilityEnvelope[],
): RuntimeStabilityEnvelope[] {
  return [...envelopes].sort((a, b) => a.score - b.score);
}

export function summarizeDependencyHealth(
  resolutions: readonly RuntimeDependencyResolution[],
): RuntimeResolutionSummary[] {
  return resolutions.map((r) => ({
    flow: r.flow,
    resolution: r.resolution,
    unresolvedCount: r.unresolvedCount,
    hiddenCount: r.hiddenCount,
    depth: r.depth,
  }));
}

export function summarizeConvergenceHealth(
  envelopes: readonly RuntimeStabilityEnvelope[],
): { flow: string; mode: string; confidence: number; divergent: boolean }[] {
  return envelopes.map((e) => ({
    flow: e.flow,
    mode: e.convergence.mode,
    confidence: e.convergence.confidence,
    divergent: e.convergence.divergent,
  }));
}
