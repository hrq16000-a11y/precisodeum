/**
 * Fase 1.8.6 — Isolation aggregation (READ-ONLY, deterministic).
 */

import type {
  IsolationAggregation,
  IsolationBoundary,
  IsolationEnvelope,
  IsolationLeak,
  IsolationSeverity,
} from './isolationTypes';

const SEVERITY_RANK: Record<IsolationSeverity, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

export function aggregateIsolation(envelopes: readonly IsolationEnvelope[]): IsolationAggregation {
  let fullyIsolated = 0, contained = 0, boundaryShared = 0, leaking = 0, collapsed = 0;
  let sum = 0;
  let worst: IsolationSeverity = 'NONE';
  for (const e of envelopes) {
    sum += e.score;
    if (SEVERITY_RANK[e.severity] > SEVERITY_RANK[worst]) worst = e.severity;
    switch (e.classification) {
      case 'FULLY_ISOLATED': fullyIsolated++; break;
      case 'CONTAINED': contained++; break;
      case 'BOUNDARY_SHARED': boundaryShared++; break;
      case 'LEAKING': leaking++; break;
      case 'COLLAPSED': collapsed++; break;
    }
  }
  const flows = envelopes.length;
  return {
    flows,
    fullyIsolated,
    contained,
    boundaryShared,
    leaking,
    collapsed,
    averageScore: flows ? Math.round((sum / flows) * 100) / 100 : 0,
    worstSeverity: worst,
  };
}

export function aggregateIsolationLeaks(leaks: readonly IsolationLeak[]): {
  total: number;
  bySeverity: Record<IsolationSeverity, number>;
} {
  const bySeverity: Record<IsolationSeverity, number> = {
    NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
  };
  for (const l of leaks) bySeverity[l.severity]++;
  return { total: leaks.length, bySeverity };
}

export function aggregateBoundaryRisks(boundaries: readonly IsolationBoundary[]): {
  total: number;
  broken: number;
  shared: number;
} {
  let broken = 0, shared = 0;
  for (const b of boundaries) {
    if (!b.intact) broken++;
    if (b.sharedWith.length > 0) shared++;
  }
  return { total: boundaries.length, broken, shared };
}

export function buildIsolationRanking(
  envelopes: readonly IsolationEnvelope[],
): readonly IsolationEnvelope[] {
  return [...envelopes].sort((a, b) => {
    const sv = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sv !== 0) return sv;
    if (a.score !== b.score) return a.score - b.score;
    return a.flow.localeCompare(b.flow);
  });
}

export function summarizeIsolationHealth(envelopes: readonly IsolationEnvelope[]): {
  ok: boolean;
  collapsed: number;
  leaking: number;
  worstSeverity: IsolationSeverity;
} {
  const a = aggregateIsolation(envelopes);
  return {
    ok: a.collapsed === 0 && a.leaking === 0 && SEVERITY_RANK[a.worstSeverity] < SEVERITY_RANK.HIGH,
    collapsed: a.collapsed,
    leaking: a.leaking,
    worstSeverity: a.worstSeverity,
  };
}
