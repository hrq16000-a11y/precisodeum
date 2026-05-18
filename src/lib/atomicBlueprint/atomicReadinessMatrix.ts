/**
 * Fase 1.7.6 — Atomic readiness matrix (READ-ONLY).
 */

import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import type {
  AtomicReadinessMatrixRow,
  MigrationStageId,
} from './atomicBlueprintTypes';
import { buildOperationBlueprint } from './operationBlueprints';
import { nextStage } from './migrationStages';
import { getRollbackStrategy } from './rollbackStrategies';
import { assessFlowRisk } from './riskAssessment';

/**
 * Estágio atual de cada flow.
 * Fase 1.7.6 mantém todos em STAGE_0_READ_ONLY (nenhuma execução foi promovida).
 */
function currentStageFor(): MigrationStageId {
  return 'STAGE_0_READ_ONLY';
}

export function buildAtomicReadinessMatrix(): AtomicReadinessMatrixRow[] {
  const rows: AtomicReadinessMatrixRow[] = [];
  for (const reg of OPERATION_REGISTRY) {
    const bp = buildOperationBlueprint(reg);
    const risk = assessFlowRisk(reg);
    const rollback = getRollbackStrategy(reg.flow);
    const stage = currentStageFor();
    rows.push({
      flow: reg.flow,
      feasibility: bp.transactional_feasibility,
      risk: risk.level,
      current_stage: stage,
      next_stage: nextStage(stage),
      rollback: rollback?.strategy ?? 'hard_abort',
      consistency: bp.consistency_requirements,
    });
  }
  return rows;
}
