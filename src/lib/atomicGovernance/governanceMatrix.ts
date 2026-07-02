/**
 * Fase 1.7.11 — Governance matrix (READ-ONLY).
 *
 * Consolida decisões finais derivadas das fases 1.7.0 → 1.7.10.
 * Nenhum estado real muda — somente recomendações declarativas.
 */

import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import { getPilotCandidate } from '@/lib/atomicPilot/pilotCandidates';
import { buildFlowPromotionState } from '@/lib/atomicPromotion/promotionMatrix';
import {
  classifyReleaseRisk,
  detectReleaseFreeze,
} from './releaseFreezePolicies';
import {
  determineRollbackAuthority,
  buildApprovalRequirement,
} from './rollbackAuthority';
import { buildReleaseWindowPolicy } from './releaseWindows';
import type {
  AtomicGovernanceState,
  GovernanceDecision,
  GovernanceDecisionMatrix,
  GovernanceFreezeLevel,
  GovernancePromotionClass,
  GovernancePromotionGuard,
} from './governanceTypes';

function classifyPromotion(
  freeze: GovernanceFreezeLevel,
  blast: string,
  conditional: boolean,
  parityScore: number,
): GovernancePromotionClass {
  if (freeze === 'HARD_FREEZE' || freeze === 'GLOBAL_FREEZE') return 'frozen';
  if (freeze === 'PARTIAL_FREEZE') return 'shadow_only';
  if (blast === 'CRITICAL') return 'shadow_only';
  if (conditional) return 'internal_compare_only';
  if (parityScore < 70) return 'internal_compare_only';
  if (parityScore < 85) return 'pilot_eligible';
  if (parityScore < 95) return 'soft_atomic_eligible';
  return 'full_atomic_eligible';
}

function decisionFromPromotion(
  cls: GovernancePromotionClass,
): GovernanceDecision {
  switch (cls) {
    case 'frozen':
      return 'FROZEN';
    case 'shadow_only':
      return 'KEEP_SHADOW';
    case 'internal_compare_only':
      return 'ALLOW_INTERNAL_COMPARE';
    case 'pilot_eligible':
      return 'ALLOW_PILOT';
    case 'soft_atomic_eligible':
      return 'ALLOW_SOFT_ATOMIC';
    case 'full_atomic_eligible':
      return 'ALLOW_FULL_ATOMIC';
    default:
      return 'HOLD';
  }
}

export function buildGovernanceState(flow: FlowId): AtomicGovernanceState | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const risk = classifyReleaseRisk(flow);
  const freeze = detectReleaseFreeze(flow);
  const promo = buildFlowPromotionState(flow);
  const cand = getPilotCandidate(flow);
  if (!risk || !promo || !cand) return null;

  const promotionClass = classifyPromotion(
    freeze.level,
    risk.blast,
    risk.conditional,
    risk.parityScore,
  );
  const decision = decisionFromPromotion(promotionClass);

  // currentStage permanece SEMPRE STAGE_0_READ_ONLY. maxAllowedStage
  // reflete a recomendação derivada da promotion matrix, mas é capada
  // pelo freeze.
  const cappedMax =
    freeze.level === 'HARD_FREEZE' || freeze.level === 'GLOBAL_FREEZE'
      ? 'STAGE_0_READ_ONLY'
      : freeze.level === 'PARTIAL_FREEZE'
      ? 'STAGE_1_SHADOW_COMPARE'
      : promo.maxAllowedStage;

  const approval = buildApprovalRequirement(flow);

  const promotionGuard: GovernancePromotionGuard = {
    flow,
    currentStage: 'STAGE_0_READ_ONLY',
    maxAllowedStage: cappedMax,
    promotionClass,
    approvalRequired: approval.state,
    liveExecutionEnabled: false,
    realUsersAllowed: false,
    retryEnabled: false,
    backgroundEnabled: false,
  };

  return {
    flow,
    decision,
    risk,
    freeze,
    promotionGuard,
    approval,
    releaseWindow: buildReleaseWindowPolicy(flow),
    rollbackAuthority: determineRollbackAuthority(flow),
    pilotStage: cand.recommendedStage,
  };
}

export function buildGovernanceMatrix(): GovernanceDecisionMatrix {
  const rows: AtomicGovernanceState[] = [];
  for (const r of OPERATION_REGISTRY) {
    const s = buildGovernanceState(r.flow);
    if (s) rows.push(s);
  }
  const totals = {
    flows: rows.length,
    frozen: rows.filter((r) => r.decision === 'FROZEN').length,
    blocked: rows.filter((r) => r.decision === 'BLOCKED').length,
    shadowOnly: rows.filter((r) => r.decision === 'KEEP_SHADOW').length,
    pilotEligible: rows.filter(
      (r) =>
        r.decision === 'ALLOW_PILOT' ||
        r.decision === 'ALLOW_SOFT_ATOMIC' ||
        r.decision === 'ALLOW_FULL_ATOMIC',
    ).length,
    fullEligible: rows.filter((r) => r.decision === 'ALLOW_FULL_ATOMIC').length,
    approvalRequired: rows.filter(
      (r) => r.approval.state !== 'not_required',
    ).length,
  };
  return { rows, totals };
}

export function summarizeGovernanceState(): string {
  const m = buildGovernanceMatrix();
  return `[GOV] flows=${m.totals.flows} frozen=${m.totals.frozen} shadow=${m.totals.shadowOnly} pilot=${m.totals.pilotEligible} full=${m.totals.fullEligible} approvalReq=${m.totals.approvalRequired}`;
}

export function rankGovernanceRisks(): FlowId[] {
  const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return buildGovernanceMatrix()
    .rows.slice()
    .sort((a, b) => RISK_ORDER[a.risk.risk] - RISK_ORDER[b.risk.risk])
    .map((r) => r.flow);
}

export function buildPromotionGovernance(
  flow: FlowId,
): GovernancePromotionGuard | null {
  const s = buildGovernanceState(flow);
  return s?.promotionGuard ?? null;
}
