/**
 * Fase 1.8.3 — Causality aggregations (READ-ONLY).
 */

import type {
  CausalityClassification,
  CausalitySeverity,
  FailureOrigin,
  PropagationMode,
  RuntimeCausalityGraph,
  RuntimeCausalityHealth,
  RuntimeCausalitySummary,
} from './causalityTypes';

const SEV_RANK: Record<CausalitySeverity, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

const CLS_RANK: Record<CausalityClassification, number> = {
  isolated: 0, dependent: 1, hidden: 2, cascading: 3, recursive: 4, circular: 5,
};

export function aggregateCausalityHealth(
  graphs: readonly RuntimeCausalityGraph[],
): RuntimeCausalityHealth {
  let healthy = 0, degraded = 0, critical = 0;
  let worst: CausalitySeverity = 'NONE';
  let worstCls: CausalityClassification = 'isolated';
  for (const g of graphs) {
    if (g.severity === 'CRITICAL') critical++;
    else if (g.severity === 'HIGH' || g.severity === 'MEDIUM') degraded++;
    else healthy++;
    if (SEV_RANK[g.severity] > SEV_RANK[worst]) worst = g.severity;
    if (CLS_RANK[g.classification] > CLS_RANK[worstCls]) worstCls = g.classification;
  }
  return {
    totalFlows: graphs.length,
    healthy,
    degraded,
    critical,
    worstSeverity: worst,
    worstClassification: worstCls,
  };
}

export function summarizeCausalityRisk(
  graphs: readonly RuntimeCausalityGraph[],
): Record<CausalitySeverity, number> {
  const out: Record<CausalitySeverity, number> = {
    NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
  };
  for (const g of graphs) out[g.severity]++;
  return out;
}

export function rankCausalityInstability(
  graphs: readonly RuntimeCausalityGraph[],
): readonly { flow: string; score: number }[] {
  const scored = graphs.map((g) => ({
    flow: g.flow,
    score:
      SEV_RANK[g.severity] * 10 +
      CLS_RANK[g.classification] * 3 +
      g.propagation.depth +
      (g.drift.unbounded ? 5 : 0) +
      (g.replay.regression ? 4 : 0),
  }));
  return scored.sort((a, b) => b.score - a.score);
}

export function summarizePropagationRisk(
  graphs: readonly RuntimeCausalityGraph[],
): Record<PropagationMode, number> {
  const out: Record<PropagationMode, number> = {
    direct: 0, indirect: 0, delayed: 0, eventual: 0, recursive: 0, circular: 0,
  };
  for (const g of graphs) out[g.propagation.mode]++;
  return out;
}

export function summarizeFailureOrigins(
  graphs: readonly RuntimeCausalityGraph[],
): Record<FailureOrigin, number> {
  const out: Record<FailureOrigin, number> = {
    owner_missing: 0, mirror_desync: 0, finalize_gap: 0, ordering_violation: 0,
    replay_divergence: 0, parity_gap: 0, stale_projection: 0, hidden_dependency: 0,
    drift_escalation: 0, orphan_state: 0,
  };
  for (const g of graphs) {
    for (const f of g.failureCauses) out[f.origin]++;
  }
  return out;
}

export function summarizeCausalityClassification(
  graphs: readonly RuntimeCausalityGraph[],
): RuntimeCausalitySummary {
  const out: RuntimeCausalitySummary = {
    totalFlows: graphs.length,
    isolated: 0, dependent: 0, cascading: 0, recursive: 0, circular: 0, hidden: 0,
  };
  const mutable: Record<CausalityClassification, number> = {
    isolated: 0, dependent: 0, cascading: 0, recursive: 0, circular: 0, hidden: 0,
  };
  for (const g of graphs) mutable[g.classification]++;
  return { ...out, ...mutable };
}
