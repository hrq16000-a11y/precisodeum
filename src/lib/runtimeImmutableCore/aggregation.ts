/**
 * Fase 1.8.8 — Immutable aggregation (READ-ONLY, deterministic).
 */

import type {
  ImmutableAggregation,
  ImmutableBoundary,
  ImmutableClassification,
  ImmutableEnvelope,
  ImmutableSeal,
  ImmutableSeverity,
  ImmutableViolation,
} from './immutableTypes';

const SEV_ORDER: ImmutableSeverity[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function aggregateImmutableViolations(
  envelopes: readonly ImmutableEnvelope[],
): readonly ImmutableViolation[] {
  return envelopes.flatMap(e => e.seal.violations);
}

export function aggregateImmutableSeals(
  envelopes: readonly ImmutableEnvelope[],
): readonly ImmutableSeal[] {
  return envelopes.map(e => e.seal);
}

export function aggregateImmutableState(
  envelopes: readonly ImmutableEnvelope[],
): ImmutableAggregation {
  let immutable = 0, sealed = 0, guarded = 0, restricted = 0, compromised = 0;
  let scoreSum = 0;
  let worst: ImmutableSeverity = 'NONE';
  let totalViolations = 0;
  for (const e of envelopes) {
    const c: ImmutableClassification = e.seal.classification;
    if (c === 'IMMUTABLE') immutable++;
    else if (c === 'SEALED') sealed++;
    else if (c === 'GUARDED') guarded++;
    else if (c === 'RESTRICTED') restricted++;
    else if (c === 'COMPROMISED') compromised++;
    scoreSum += e.score;
    if (SEV_ORDER.indexOf(e.seal.severity) > SEV_ORDER.indexOf(worst)) worst = e.seal.severity;
    totalViolations += e.seal.violations.length;
  }
  const flows = envelopes.length;
  return {
    flows, immutable, sealed, guarded, restricted, compromised,
    averageScore: flows === 0 ? 0 : Number((scoreSum / flows).toFixed(4)),
    worstSeverity: worst, totalViolations,
  };
}

export function buildImmutableRanking(
  envelopes: readonly ImmutableEnvelope[],
): readonly ImmutableEnvelope[] {
  const order: Record<ImmutableClassification, number> = {
    IMMUTABLE: 0, SEALED: 1, GUARDED: 2, RESTRICTED: 3, COMPROMISED: 4,
  };
  return [...envelopes].sort((a, b) => {
    const d = order[a.seal.classification] - order[b.seal.classification];
    if (d !== 0) return d;
    return b.score - a.score;
  });
}

export function summarizeImmutableHealth(
  envelopes: readonly ImmutableEnvelope[],
): { readonly healthy: boolean; readonly classification: ImmutableClassification; readonly score: number } {
  const agg = aggregateImmutableState(envelopes);
  const cls: ImmutableClassification =
    agg.compromised > 0 ? 'COMPROMISED' :
    agg.restricted > 0 ? 'RESTRICTED' :
    agg.guarded > 0 ? 'GUARDED' :
    agg.sealed > 0 ? 'SEALED' :
    agg.immutable > 0 ? 'IMMUTABLE' : 'IMMUTABLE';
  return {
    healthy: agg.compromised === 0 && agg.worstSeverity !== 'CRITICAL',
    classification: cls,
    score: agg.averageScore,
  };
}

export function buildEnvelope(seal: ImmutableSeal): ImmutableEnvelope {
  let score = 1.0;
  score -= seal.violations.length * 0.1;
  if (seal.compromised) score -= 0.5;
  else if (seal.classification === 'RESTRICTED') score -= 0.25;
  else if (seal.classification === 'GUARDED') score -= 0.1;
  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));
  return {
    flow: seal.flow,
    seal,
    score,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    currentStage: 'STAGE_0_READ_ONLY',
  };
}

export type { ImmutableBoundary };
