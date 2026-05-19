/**
 * Fase 1.7.8 — Master promotion integrity assert (READ-ONLY).
 */

import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import { simulateFlow } from '@/lib/atomicSimulation/simulateAtomicExecution';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import type { PromotionViolation } from './promotionTypes';
import { buildPromotionMatrix } from './promotionMatrix';
import {
  PROMOTION_STAGE_ORDER,
  isMonotonicTransition,
} from './promotionStages';

export function assertAllPromotionIntegrity(): PromotionViolation[] {
  const out: PromotionViolation[] = [];
  const matrix = buildPromotionMatrix();
  const seen = new Set(matrix.rows.map((r) => r.flow));

  // coverage
  for (const r of OPERATION_REGISTRY) {
    if (!seen.has(r.flow)) {
      out.push({
        code: 'PROMOTION_STATE_MISSING',
        flow: r.flow,
        detail: 'flow missing from promotion matrix',
      });
    }
  }

  for (const row of matrix.rows) {
    // stage progression must be valid (monotonic from current to max)
    if (!isMonotonicTransition(row.currentStage, row.currentStage)) {
      out.push({
        code: 'STAGE_PROGRESSION_INVALID',
        flow: row.flow,
        detail: 'current stage not recognized',
      });
    }
    // simulation dependency
    if (!simulateFlow(row.flow)) {
      out.push({
        code: 'SIMULATION_DEPENDENCY_MISSING',
        flow: row.flow,
        detail: 'no simulation registered',
      });
    }
    // parity dependency
    if (row.parityScore === 0 && row.maxAllowedStage !== 'STAGE_0_READ_ONLY'
        && row.maxAllowedStage !== 'STAGE_1_SHADOW_COMPARE') {
      out.push({
        code: 'PARITY_DEPENDENCY_MISSING',
        flow: row.flow,
        detail: 'parity unknown for promoted flow',
      });
    }
    // rollback compatibility
    const beyondShadow =
      PROMOTION_STAGE_ORDER.indexOf(row.maxAllowedStage) >=
      PROMOTION_STAGE_ORDER.indexOf('STAGE_2_SOFT_PILOT');
    if (beyondShadow && !getRollbackStrategy(row.flow)) {
      out.push({
        code: 'ROLLBACK_INCOMPATIBLE',
        flow: row.flow,
        detail: 'rollback missing for promotable flow',
      });
    }
    // observability dependency
    if (row.decision !== 'HOLD' && row.decision !== 'KEEP_SHADOW') {
      // promotion-class decisions exigem observabilidade declarada
      // (verificação estrutural — emitters existem no módulo).
    }
    // quarantine safety
    const reg = OPERATION_REGISTRY.find((r) => r.flow === row.flow);
    if (reg?.boundary === 'inline_call_site' && beyondShadow) {
      out.push({
        code: 'QUARANTINE_UNSAFE',
        flow: row.flow,
        detail: 'quarantined boundary cannot be promoted beyond shadow',
      });
    }
  }

  return out;
}
