/**
 * Fase 1.7.10 — Rollout strategies (READ-ONLY, declarative).
 *
 * Nenhuma estratégia é aplicada. Apenas calcula a forma "ideal"
 * para um eventual rollout futuro.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import {
  getPilotCandidate,
  buildPilotCandidates,
} from './pilotCandidates';
import type {
  PilotCohort,
  PilotPromotionPolicy,
  PilotRiskLevel,
  PilotRolloutStrategy,
} from './pilotTypes';

function policyFor(risk: PilotRiskLevel, parity: number): PilotPromotionPolicy {
  if (risk === 'CRITICAL') return 'frozen';
  if (risk === 'HIGH') return 'manual_only';
  if (parity < 75) return 'staged_internal';
  if (parity < 90) return 'staged_safe_cohort';
  return 'staged_progressive';
}

function cohortsFor(risk: PilotRiskLevel, quarantined: boolean): PilotCohort[] {
  if (quarantined) return ['internal_only'];
  if (risk === 'CRITICAL') return ['internal_only'];
  if (risk === 'HIGH') return ['internal_only', 'admin_only'];
  if (risk === 'MEDIUM') {
    return ['internal_only', 'low_risk_users', 'safe_boundary_only'];
  }
  return [
    'internal_only',
    'low_risk_users',
    'non_provider_only',
    'safe_boundary_only',
  ];
}

function percentageFor(policy: PilotPromotionPolicy): number {
  switch (policy) {
    case 'frozen':
      return 0;
    case 'manual_only':
      return 0;
    case 'staged_internal':
      return 1;
    case 'staged_safe_cohort':
      return 5;
    case 'staged_progressive':
      return 10;
  }
}

export function buildRolloutStrategy(
  flow: FlowId,
): PilotRolloutStrategy | null {
  const c = getPilotCandidate(flow);
  if (!c) return null;
  const policy = policyFor(c.risk, c.parityScore);
  const cohorts = cohortsFor(
    c.risk,
    c.recommendedStage === 'STAGE_1_INTERNAL_SHADOW' && c.eligibility === 'BLOCKED',
  );
  return {
    flow,
    policy,
    percentage: percentageFor(policy),
    cohorts,
    progressiveExposure:
      policy === 'staged_progressive' || policy === 'staged_safe_cohort',
    shadowCompareRequired: true,
    mirrorValidationRequired: c.risk !== 'LOW',
    driftTolerance:
      c.risk === 'LOW' ? 'LOW' : c.risk === 'MEDIUM' ? 'LOW' : 'ZERO',
  };
}

export function calculateRolloutRisk(flow: FlowId): PilotRiskLevel {
  const c = getPilotCandidate(flow);
  return c?.risk ?? 'CRITICAL';
}

export function supportsSafeRollout(flow: FlowId): boolean {
  const s = buildRolloutStrategy(flow);
  if (!s) return false;
  return s.policy !== 'frozen' && s.policy !== 'manual_only';
}

export function supportsSafeAbort(flow: FlowId): boolean {
  const c = getPilotCandidate(flow);
  if (!c) return false;
  return c.rollback !== 'incompatible';
}

export function supportsProgressiveExposure(flow: FlowId): boolean {
  return buildRolloutStrategy(flow)?.progressiveExposure ?? false;
}

export function buildAllRolloutStrategies(): PilotRolloutStrategy[] {
  const out: PilotRolloutStrategy[] = [];
  for (const c of buildPilotCandidates()) {
    const s = buildRolloutStrategy(c.flow);
    if (s) out.push(s);
  }
  return out;
}
