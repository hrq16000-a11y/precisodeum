/**
 * Fase 1.7.8 — Promotion guards (READ-ONLY, pure asserts).
 *
 * Retornam arrays de violations. NUNCA executam side-effects nem alteram
 * estado. NUNCA permitem promoção real.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  PromotionBlocker,
  PromotionFlowState,
  PromotionStageId,
} from './promotionTypes';
import {
  PROMOTION_STAGE_ORDER,
  isMonotonicTransition,
  stageIndex,
} from './promotionStages';

export interface PromotionGuardViolation {
  code: PromotionBlocker['code'] | 'stage_progression_invalid' | 'coverage_gap';
  flow?: FlowId;
  detail: string;
}

export function assertNoUnsafePromotion(
  state: PromotionFlowState,
): PromotionGuardViolation[] {
  const out: PromotionGuardViolation[] = [];
  if (stageIndex(state.currentStage) > stageIndex(state.maxAllowedStage)) {
    out.push({
      code: 'unsafe_promotion_attempt',
      flow: state.flow,
      detail: `current=${state.currentStage} exceeds max=${state.maxAllowedStage}`,
    });
  }
  return out;
}

export function assertPromotionCoverage(
  states: PromotionFlowState[],
  expectedFlows: readonly FlowId[],
): PromotionGuardViolation[] {
  const present = new Set(states.map((s) => s.flow));
  const out: PromotionGuardViolation[] = [];
  for (const f of expectedFlows) {
    if (!present.has(f)) {
      out.push({
        code: 'coverage_gap',
        flow: f,
        detail: 'flow missing from promotion matrix',
      });
    }
  }
  return out;
}

export function assertPromotionSafety(
  state: PromotionFlowState,
): PromotionGuardViolation[] {
  const out: PromotionGuardViolation[] = [];
  if (state.blastRadius === 'CRITICAL' && state.maxAllowedStage !== 'STAGE_0_READ_ONLY'
      && state.maxAllowedStage !== 'STAGE_1_SHADOW_COMPARE') {
    out.push({
      code: 'unsafe_blast_radius',
      flow: state.flow,
      detail: 'CRITICAL blast must stay in shadow or below',
    });
  }
  return out;
}

export function assertNoForbiddenStageEscalation(
  from: PromotionStageId,
  to: PromotionStageId,
  flow?: FlowId,
): PromotionGuardViolation[] {
  if (!isMonotonicTransition(from, to)) {
    return [
      {
        code: 'forbidden_stage_transition',
        flow,
        detail: `non-monotonic transition ${from} -> ${to}`,
      },
    ];
  }
  return [];
}

export function assertRollbackCompatibility(
  state: PromotionFlowState,
): PromotionGuardViolation[] {
  const out: PromotionGuardViolation[] = [];
  const beyondShadow =
    stageIndex(state.maxAllowedStage) >= stageIndex('STAGE_2_SOFT_PILOT');
  if (state.rollbackClass === 'incompatible' && beyondShadow) {
    out.push({
      code: 'missing_rollback',
      flow: state.flow,
      detail: 'rollback incompatible blocks SOFT_PILOT+',
    });
  }
  return out;
}

export function getStageOrder(): readonly PromotionStageId[] {
  return PROMOTION_STAGE_ORDER;
}
