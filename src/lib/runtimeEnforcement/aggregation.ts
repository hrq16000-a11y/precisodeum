/**
 * Fase 1.8.7 — Enforcement aggregation (READ-ONLY, deterministic).
 */

import type {
  EnforcementAggregation,
  EnforcementBoundary,
  EnforcementClassification,
  EnforcementEnvelope,
  EnforcementSeverity,
  EnforcementViolation,
  RuntimeEnforcement,
} from './enforcementTypes';

const SEVERITY_ORDER: EnforcementSeverity[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function aggregateViolations(
  envelopes: readonly EnforcementEnvelope[],
): readonly EnforcementViolation[] {
  return envelopes.flatMap(e => e.enforcement.violations);
}

export function aggregateBoundaryLocks(
  envelopes: readonly EnforcementEnvelope[],
): readonly EnforcementBoundary[] {
  return envelopes.flatMap(e => e.enforcement.boundaries.filter(b => b.locked));
}

export function aggregateEnforcement(
  envelopes: readonly EnforcementEnvelope[],
): EnforcementAggregation {
  const flows = envelopes.length;
  let safe = 0, guarded = 0, restricted = 0, blocked = 0, locked = 0;
  let scoreSum = 0;
  let worst: EnforcementSeverity = 'NONE';
  let totalViolations = 0;
  for (const e of envelopes) {
    const c: EnforcementClassification = e.enforcement.classification;
    if (c === 'SAFE') safe++;
    else if (c === 'GUARDED') guarded++;
    else if (c === 'RESTRICTED') restricted++;
    else if (c === 'BLOCKED') blocked++;
    else if (c === 'LOCKED') locked++;
    scoreSum += e.score;
    if (SEVERITY_ORDER.indexOf(e.enforcement.severity) > SEVERITY_ORDER.indexOf(worst)) {
      worst = e.enforcement.severity;
    }
    totalViolations += e.enforcement.violations.length;
  }
  return {
    flows, safe, guarded, restricted, blocked, locked,
    averageScore: flows === 0 ? 0 : Number((scoreSum / flows).toFixed(4)),
    worstSeverity: worst, totalViolations,
  };
}

export function buildEnforcementRanking(
  envelopes: readonly EnforcementEnvelope[],
): readonly EnforcementEnvelope[] {
  const order: Record<EnforcementClassification, number> = {
    LOCKED: 0, SAFE: 1, GUARDED: 2, RESTRICTED: 3, BLOCKED: 4,
  };
  return [...envelopes].sort((a, b) => {
    const d = order[a.enforcement.classification] - order[b.enforcement.classification];
    if (d !== 0) return d;
    return b.score - a.score;
  });
}

export function summarizeEnforcementHealth(
  envelopes: readonly EnforcementEnvelope[],
): { readonly healthy: boolean; readonly classification: EnforcementClassification; readonly score: number } {
  const agg = aggregateEnforcement(envelopes);
  const cls: EnforcementClassification =
    agg.blocked > 0 ? 'BLOCKED' :
    agg.restricted > 0 ? 'RESTRICTED' :
    agg.guarded > 0 ? 'GUARDED' :
    agg.locked > 0 ? 'LOCKED' :
    agg.safe > 0 ? 'SAFE' : 'LOCKED';
  return { healthy: agg.blocked === 0 && agg.worstSeverity !== 'CRITICAL', classification: cls, score: agg.averageScore };
}

export function deriveEnforcement(
  flow: RuntimeEnforcement['flow'],
  boundaries: readonly EnforcementBoundary[],
  violations: readonly EnforcementViolation[],
  invariants: RuntimeEnforcement['invariants'],
  lockdown: RuntimeEnforcement['lockdown'],
): RuntimeEnforcement {
  let worst: EnforcementSeverity = 'NONE';
  for (const v of violations) {
    if (SEVERITY_ORDER.indexOf(v.severity) > SEVERITY_ORDER.indexOf(worst)) worst = v.severity;
  }
  let classification: EnforcementClassification = 'LOCKED';
  if (boundaries.some(b => b.classification === 'BLOCKED') || worst === 'CRITICAL') classification = 'BLOCKED';
  else if (boundaries.some(b => b.classification === 'RESTRICTED') || worst === 'HIGH') classification = 'RESTRICTED';
  else if (worst === 'MEDIUM' || worst === 'LOW') classification = 'GUARDED';
  else if (boundaries.every(b => b.locked) && boundaries.length > 0) classification = 'LOCKED';
  else if (boundaries.length > 0) classification = 'SAFE';
  return { flow, classification, severity: worst, boundaries, violations, invariants, lockdown };
}

export function buildEnvelope(enforcement: RuntimeEnforcement): EnforcementEnvelope {
  let score = 1.0;
  score -= enforcement.violations.length * 0.1;
  if (enforcement.classification === 'BLOCKED') score -= 0.5;
  else if (enforcement.classification === 'RESTRICTED') score -= 0.25;
  else if (enforcement.classification === 'GUARDED') score -= 0.1;
  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));
  return {
    flow: enforcement.flow,
    enforcement,
    score,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    currentStage: 'STAGE_0_READ_ONLY',
  };
}
