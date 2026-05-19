/**
 * Fase 1.7.11 — Release freeze policies (READ-ONLY).
 *
 * Regras:
 *   - blast CRITICAL  → HARD_FREEZE
 *   - blast HIGH + rollback incompatível → PARTIAL_FREEZE
 *   - quarantined → HARD_FREEZE
 *   - CONDITIONAL eligibility → SOFT_FREEZE (não passa de shadow)
 *   - live execution permanece SEMPRE false
 *   - retries/background permanecem proibidos
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import { getPilotCandidate } from '@/lib/atomicPilot/pilotCandidates';
import { buildFlowPromotionState } from '@/lib/atomicPromotion/promotionMatrix';
import type {
  GovernanceFreezeLevel,
  GovernanceFreezePolicy,
  GovernanceRiskAssessment,
  GovernanceRiskLevel,
} from './governanceTypes';

export function classifyReleaseRisk(flow: FlowId): GovernanceRiskAssessment | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  const cand = getPilotCandidate(flow);
  if (!reg || !cand) return null;
  const blast = cand.blast;
  const parity = cand.parityScore;
  const rollbackClass = cand.rollback;
  const quarantined = reg.boundary === 'inline_call_site';
  const mirrorDependency = reg.boundary === 'multiWriteSync';
  const conditional = cand.eligibility === 'CONDITIONAL';
  const critical =
    cand.eligibility === 'BLOCKED' ||
    blast === 'CRITICAL' ||
    rollbackClass === 'incompatible';

  let risk: GovernanceRiskLevel = 'LOW';
  if (critical) risk = 'CRITICAL';
  else if (blast === 'HIGH' || parity < 60) risk = 'HIGH';
  else if (blast === 'MEDIUM' || parity < 80) risk = 'MEDIUM';

  return {
    flow,
    blast,
    risk,
    parityScore: parity,
    confidence: cand.confidence,
    rollbackClass,
    quarantined,
    mirrorDependency,
    conditional,
    critical,
  };
}

export function calculateFreezeSeverity(flow: FlowId): GovernanceFreezeLevel {
  const r = classifyReleaseRisk(flow);
  if (!r) return 'GLOBAL_FREEZE';
  if (r.quarantined) return 'HARD_FREEZE';
  if (r.blast === 'CRITICAL') return 'HARD_FREEZE';
  if (r.rollbackClass === 'incompatible') return 'PARTIAL_FREEZE';
  if (r.blast === 'HIGH' && r.parityScore < 70) return 'PARTIAL_FREEZE';
  if (r.conditional) return 'SOFT_FREEZE';
  if (r.parityScore < 60) return 'SOFT_FREEZE';
  return 'NONE';
}

export function detectReleaseFreeze(flow: FlowId): GovernanceFreezePolicy {
  const risk = classifyReleaseRisk(flow);
  const level = calculateFreezeSeverity(flow);
  const reasons: string[] = [];
  if (risk?.quarantined) reasons.push('quarantined_boundary');
  if (risk?.blast === 'CRITICAL') reasons.push('critical_blast_radius');
  if (risk?.rollbackClass === 'incompatible') reasons.push('incompatible_rollback');
  if (risk && risk.parityScore < 60) reasons.push('insufficient_parity');
  if (risk?.conditional) reasons.push('conditional_eligibility');
  if (level === 'GLOBAL_FREEZE') reasons.push('flow_not_registered');

  return {
    flow,
    level,
    reasons,
    expiresStage:
      level === 'HARD_FREEZE'
        ? null
        : level === 'PARTIAL_FREEZE'
        ? 'STAGE_1_SHADOW_COMPARE'
        : level === 'SOFT_FREEZE'
        ? 'STAGE_2_SOFT_PILOT'
        : null,
    overrideAuthority:
      level === 'HARD_FREEZE' || level === 'GLOBAL_FREEZE'
        ? 'governance_board'
        : level === 'PARTIAL_FREEZE'
        ? 'release_manager'
        : level === 'SOFT_FREEZE'
        ? 'flow_owner'
        : null,
    blocksPromotion: level === 'HARD_FREEZE' || level === 'GLOBAL_FREEZE',
    blocksRollout: level !== 'NONE',
  };
}

export function detectUnsafePromotionWindow(flow: FlowId): boolean {
  const promo = buildFlowPromotionState(flow);
  const freeze = detectReleaseFreeze(flow);
  if (!promo) return true;
  // qualquer recomendação acima de shadow com freeze ativo é unsafe
  if (
    (freeze.level === 'HARD_FREEZE' || freeze.level === 'GLOBAL_FREEZE') &&
    promo.maxAllowedStage !== 'STAGE_0_READ_ONLY' &&
    promo.maxAllowedStage !== 'STAGE_1_SHADOW_COMPARE'
  ) {
    return true;
  }
  if (
    freeze.level === 'PARTIAL_FREEZE' &&
    (promo.maxAllowedStage === 'STAGE_3_PARTIAL_ATOMIC' ||
      promo.maxAllowedStage === 'STAGE_4_FULL_ATOMIC')
  ) {
    return true;
  }
  return false;
}

export function requiresGovernanceApproval(flow: FlowId): boolean {
  const freeze = detectReleaseFreeze(flow);
  if (freeze.level !== 'NONE') return true;
  const risk = classifyReleaseRisk(flow);
  if (!risk) return true;
  if (risk.risk === 'CRITICAL' || risk.risk === 'HIGH') return true;
  return false;
}
