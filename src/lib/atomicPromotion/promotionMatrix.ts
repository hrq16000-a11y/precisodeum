/**
 * Fase 1.7.8 — Promotion matrix (READ-ONLY).
 *
 * Toda promoção é apenas RECOMENDAÇÃO formal — nenhum flow é alterado.
 * currentStage permanece STAGE_0_READ_ONLY até execução manual futura.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import { compareLegacyVsAtomic } from '@/lib/atomicSimulation/executionParity';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import type { RollbackStrategyId } from '@/lib/atomicBlueprint/atomicBlueprintTypes';
import type {
  PromotionConfidence,
  PromotionDecision,
  PromotionFlowState,
  PromotionMatrix,
  PromotionRollbackClass,
  PromotionStageId,
} from './promotionTypes';
import {
  calculatePromotionConfidence,
  detectPromotionBlockers,
} from './promotionEligibility';
import { PROMOTION_STAGE_ORDER, stageIndex } from './promotionStages';

const ROLLBACK_CLASS: Record<RollbackStrategyId, PromotionRollbackClass> = {
  compensating_write: 'compensation_required',
  safe_retry: 'safe_retry',
  noop_rollback: 'noop',
  hard_abort: 'hard_abort',
  partial_visibility: 'compensation_required',
  delayed_reconciliation: 'compensation_required',
};

function classifyRollback(flow: FlowId): {
  klass: PromotionRollbackClass;
  strategy: RollbackStrategyId | null;
} {
  const r = getRollbackStrategy(flow);
  if (!r) return { klass: 'incompatible', strategy: null };
  return { klass: ROLLBACK_CLASS[r.strategy], strategy: r.strategy };
}

function maxStageFor(
  confidence: PromotionConfidence,
  blastLevel: string,
  rollback: PromotionRollbackClass,
  hasCriticalBlocker: boolean,
  hasHighBlocker: boolean,
): PromotionStageId {
  if (hasCriticalBlocker) return 'STAGE_0_READ_ONLY';
  if (rollback === 'incompatible') return 'STAGE_1_SHADOW_COMPARE';
  if (blastLevel === 'CRITICAL') return 'STAGE_1_SHADOW_COMPARE';
  if (hasHighBlocker) return 'STAGE_1_SHADOW_COMPARE';
  if (confidence === 'NONE' || confidence === 'LOW') {
    return 'STAGE_1_SHADOW_COMPARE';
  }
  if (confidence === 'MODERATE') return 'STAGE_2_SOFT_PILOT';
  if (confidence === 'HIGH') return 'STAGE_3_PARTIAL_ATOMIC';
  return 'STAGE_4_FULL_ATOMIC';
}

function decisionFor(
  current: PromotionStageId,
  max: PromotionStageId,
  hasCriticalBlocker: boolean,
): PromotionDecision {
  if (hasCriticalBlocker) return 'BLOCKED';
  const c = stageIndex(current);
  const m = stageIndex(max);
  if (m <= c) return current === 'STAGE_0_READ_ONLY' ? 'HOLD' : 'KEEP_SHADOW';
  const next = PROMOTION_STAGE_ORDER[c + 1];
  switch (next) {
    case 'STAGE_1_SHADOW_COMPARE':
      return 'KEEP_SHADOW';
    case 'STAGE_2_SOFT_PILOT':
      return 'PROMOTE_TO_PILOT';
    case 'STAGE_3_PARTIAL_ATOMIC':
      return 'PROMOTE_TO_SOFT';
    case 'STAGE_4_FULL_ATOMIC':
      return 'PROMOTE_TO_FULL';
    default:
      return 'HOLD';
  }
}

export function buildFlowPromotionState(flow: FlowId): PromotionFlowState | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;

  const blockers = detectPromotionBlockers(flow);
  const hasCritical = blockers.some((b) => b.severity === 'CRITICAL');
  const hasHigh = blockers.some((b) => b.severity === 'HIGH');

  const blast = calculateBlastRadius(flow);
  const parity = compareLegacyVsAtomic(flow);
  const confidence = calculatePromotionConfidence(flow);
  const { klass: rollbackClass, strategy } = classifyRollback(flow);

  // Esta fase é 100% read-only: currentStage SEMPRE STAGE_0_READ_ONLY.
  const currentStage: PromotionStageId = 'STAGE_0_READ_ONLY';
  const maxAllowedStage = maxStageFor(
    confidence,
    blast?.level ?? 'CRITICAL',
    rollbackClass,
    hasCritical,
    hasHigh,
  );
  const recommendation = decisionFor(currentStage, maxAllowedStage, hasCritical);

  return {
    flow,
    currentStage,
    maxAllowedStage,
    decision: recommendation,
    confidence,
    risk: blast?.level ?? 'CRITICAL',
    rollbackClass,
    rollbackStrategy: strategy,
    blastRadius: blast?.level ?? 'CRITICAL',
    parityScore: parity?.score ?? 0,
    blockers,
    recommendation,
  };
}

export function buildPromotionMatrix(): PromotionMatrix {
  const rows: PromotionFlowState[] = [];
  for (const r of OPERATION_REGISTRY) {
    const s = buildFlowPromotionState(r.flow);
    if (s) rows.push(s);
  }
  const totals = {
    flows: rows.length,
    pilotReady: rows.filter(
      (r) => stageIndex(r.maxAllowedStage) >= stageIndex('STAGE_2_SOFT_PILOT'),
    ).length,
    softReady: rows.filter(
      (r) =>
        stageIndex(r.maxAllowedStage) >= stageIndex('STAGE_3_PARTIAL_ATOMIC'),
    ).length,
    fullReady: rows.filter((r) => r.maxAllowedStage === 'STAGE_4_FULL_ATOMIC')
      .length,
    blocked: rows.filter((r) => r.decision === 'BLOCKED').length,
  };
  return { rows, totals };
}

export function summarizePromotionReadiness(): string {
  const m = buildPromotionMatrix();
  return `[PROMOTION] flows=${m.totals.flows} pilot=${m.totals.pilotReady} soft=${m.totals.softReady} full=${m.totals.fullReady} blocked=${m.totals.blocked}`;
}

export function rankPromotionCandidates(): FlowId[] {
  const m = buildPromotionMatrix();
  return m.rows
    .slice()
    .sort((a, b) => {
      const sa = stageIndex(a.maxAllowedStage);
      const sb = stageIndex(b.maxAllowedStage);
      if (sb !== sa) return sb - sa;
      return b.parityScore - a.parityScore;
    })
    .map((r) => r.flow);
}
