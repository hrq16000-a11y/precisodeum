/**
 * Fase 1.7.10 — Pilot candidate detection (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import { compareLegacyVsAtomic } from '@/lib/atomicSimulation/executionParity';
import { calculateRpcReadiness } from '@/lib/rpcContracts/rpcReadiness';
import { buildFlowPromotionState } from '@/lib/atomicPromotion/promotionMatrix';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import type { RollbackStrategyId } from '@/lib/atomicBlueprint/atomicBlueprintTypes';
import type {
  AtomicPilotCandidate,
  AtomicPilotStage,
  PilotEligibility,
  PilotRiskLevel,
  PilotRollbackClass,
} from './pilotTypes';

const ROLLBACK_CLASS: Record<RollbackStrategyId, PilotRollbackClass> = {
  compensating_write: 'compensation_required',
  safe_retry: 'safe_retry',
  noop_rollback: 'noop',
  hard_abort: 'hard_abort',
  partial_visibility: 'compensation_required',
  delayed_reconciliation: 'compensation_required',
};

function classifyRisk(blast: string, parity: number): PilotRiskLevel {
  if (blast === 'CRITICAL') return 'CRITICAL';
  if (blast === 'HIGH') return 'HIGH';
  if (parity < 60) return 'HIGH';
  if (blast === 'MEDIUM' || parity < 80) return 'MEDIUM';
  return 'LOW';
}

function recommendedStage(
  risk: PilotRiskLevel,
  parity: number,
  rollbackOk: boolean,
  quarantined: boolean,
): AtomicPilotStage {
  if (quarantined) return 'STAGE_1_INTERNAL_SHADOW';
  if (risk === 'CRITICAL') return 'STAGE_2_INTERNAL_COMPARE';
  if (!rollbackOk) return 'STAGE_2_INTERNAL_COMPARE';
  if (parity < 60) return 'STAGE_1_INTERNAL_SHADOW';
  if (parity < 80) return 'STAGE_2_INTERNAL_COMPARE';
  if (parity < 90) return 'STAGE_3_SAFE_COHORT';
  if (parity < 95) return 'STAGE_4_LIMITED_PRODUCTION';
  return 'STAGE_5_FULL_PROMOTION';
}

export function buildPilotCandidates(): AtomicPilotCandidate[] {
  const out: AtomicPilotCandidate[] = [];
  for (const reg of OPERATION_REGISTRY) {
    const blast = calculateBlastRadius(reg.flow);
    const parity = compareLegacyVsAtomic(reg.flow);
    const rpc = calculateRpcReadiness(reg.flow);
    const promo = buildFlowPromotionState(reg.flow);
    const rb = getRollbackStrategy(reg.flow);
    const quarantined = reg.boundary === 'inline_call_site';

    const blastLevel = blast?.level ?? 'CRITICAL';
    const parityScore = parity?.score ?? 0;
    const risk = classifyRisk(blastLevel, parityScore);
    const rollbackClass: PilotRollbackClass = rb
      ? ROLLBACK_CLASS[rb.strategy]
      : 'incompatible';
    const rollbackOk = rollbackClass !== 'incompatible';

    let eligibility: PilotEligibility = 'READY';
    let blockerCount = 0;
    if (quarantined) {
      eligibility = 'BLOCKED';
      blockerCount++;
    }
    if (blastLevel === 'CRITICAL') {
      eligibility = eligibility === 'BLOCKED' ? 'BLOCKED' : 'CONDITIONAL';
      blockerCount++;
    }
    if (!rollbackOk) {
      eligibility = eligibility === 'BLOCKED' ? 'BLOCKED' : 'CONDITIONAL';
      blockerCount++;
    }
    if (parityScore < 60) {
      eligibility = eligibility === 'BLOCKED' ? 'BLOCKED' : 'CONDITIONAL';
      blockerCount++;
    }
    if (!rpc || rpc.readinessScore < 50) {
      eligibility = eligibility === 'BLOCKED' ? 'BLOCKED' : 'NOT_ELIGIBLE';
      blockerCount++;
    }

    const stage = recommendedStage(risk, parityScore, rollbackOk, quarantined);

    out.push({
      flow: reg.flow,
      eligibility,
      recommendedStage: stage,
      risk,
      blast: blastLevel,
      parityScore,
      confidence: promo?.confidence ?? 'NONE',
      promotion: promo?.maxAllowedStage ?? 'STAGE_0_READ_ONLY',
      rollback: rollbackClass,
      blockerCount,
      rationale: `risk=${risk} blast=${blastLevel} parity=${parityScore} rollback=${rollbackClass} quarantined=${quarantined}`,
    });
  }
  return out;
}

export function rankPilotCandidates(): AtomicPilotCandidate[] {
  return buildPilotCandidates()
    .slice()
    .sort((a, b) => {
      // READY > CONDITIONAL > NOT_ELIGIBLE > BLOCKED
      const order = { READY: 0, CONDITIONAL: 1, NOT_ELIGIBLE: 2, BLOCKED: 3 };
      const oa = order[a.eligibility];
      const ob = order[b.eligibility];
      if (oa !== ob) return oa - ob;
      // higher parity first
      if (b.parityScore !== a.parityScore) return b.parityScore - a.parityScore;
      // lower blast first
      const blastOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
      return blastOrder[a.blast] - blastOrder[b.blast];
    });
}

export function detectUnsafePilotCandidates(): AtomicPilotCandidate[] {
  return buildPilotCandidates().filter(
    (c) =>
      c.eligibility === 'BLOCKED' ||
      (c.blast === 'CRITICAL' &&
        c.recommendedStage !== 'STAGE_1_INTERNAL_SHADOW' &&
        c.recommendedStage !== 'STAGE_2_INTERNAL_COMPARE'),
  );
}

export function explainPilotCandidate(c: AtomicPilotCandidate): string {
  return `[PILOT/${c.eligibility}] ${c.flow} stage=${c.recommendedStage} risk=${c.risk} blast=${c.blast} parity=${c.parityScore} rollback=${c.rollback} blockers=${c.blockerCount}`;
}

export function getPilotCandidate(flow: FlowId): AtomicPilotCandidate | null {
  return buildPilotCandidates().find((c) => c.flow === flow) ?? null;
}
