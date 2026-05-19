/**
 * Fase 1.7.11 — Governance explainers (READ-ONLY, pure strings).
 */

import type {
  AtomicGovernanceState,
  GovernanceApprovalRequirement,
  GovernanceFreezePolicy,
  GovernancePromotionGuard,
  GovernanceRiskAssessment,
  GovernanceRollbackAuthority,
} from './governanceTypes';

export function explainGovernanceDecision(s: AtomicGovernanceState): string {
  return `[GOV/${s.decision}] ${s.flow} freeze=${s.freeze.level} promotionClass=${s.promotionGuard.promotionClass} maxAllowed=${s.promotionGuard.maxAllowedStage} approval=${s.approval.state} rollbackAuthority=${s.rollbackAuthority}`;
}

export function explainFreezePolicy(f: GovernanceFreezePolicy): string {
  return `[FREEZE/${f.level}] ${f.flow} reasons=${f.reasons.join(',') || 'none'} blocksPromotion=${f.blocksPromotion} blocksRollout=${f.blocksRollout}`;
}

export function explainPromotionGuard(g: GovernancePromotionGuard): string {
  return `[GUARD] ${g.flow} class=${g.promotionClass} current=${g.currentStage} max=${g.maxAllowedStage} approval=${g.approvalRequired} live=false realUsers=false retry=false`;
}

export function explainGovernanceRisk(r: GovernanceRiskAssessment): string {
  return `[RISK/${r.risk}] ${r.flow} blast=${r.blast} parity=${r.parityScore} rollback=${r.rollbackClass} quarantined=${r.quarantined} mirror=${r.mirrorDependency}`;
}

export function explainRollbackAuthority(
  flow: string,
  authority: GovernanceRollbackAuthority,
): string {
  return `[AUTHORITY] ${flow} rollback=${authority}`;
}

export function explainApprovalRequirement(
  a: GovernanceApprovalRequirement,
): string {
  return `[APPROVAL/${a.state}] ${a.flow} reviewers=${a.reviewers} board=${a.requiresGovernanceBoard} incident=${a.requiresIncidentCommander}`;
}
