/**
 * Fase 1.7.8 — Formal promotion stages (READ-ONLY).
 */

import type {
  PromotionStageDescriptor,
  PromotionStageId,
} from './promotionTypes';

export const PROMOTION_STAGES: readonly PromotionStageDescriptor[] = [
  {
    id: 'STAGE_0_READ_ONLY',
    prerequisites: ['operation registered', 'contracts declared'],
    blockers: ['simulation_missing'],
    rollbackBehavior: 'none',
    requiredObservability: ['operation_build_failed'],
    requiredParityConfidence: 'NONE',
    allowedFlows: 'all',
    forbiddenConditions: ['live execution'],
  },
  {
    id: 'STAGE_1_SHADOW_COMPARE',
    prerequisites: ['simulation coverage', 'parity matrix'],
    blockers: ['simulation_missing', 'insufficient_parity'],
    rollbackBehavior: 'none',
    requiredObservability: ['atomic_simulation_generated', 'divergence_detected'],
    requiredParityConfidence: 'LOW',
    allowedFlows: 'all',
    forbiddenConditions: ['unresolved CRITICAL blast radius without isolation'],
  },
  {
    id: 'STAGE_2_SOFT_PILOT',
    prerequisites: [
      'shadow validation',
      'rollback strategy',
      'observability hooks',
    ],
    blockers: [
      'missing_shadow_validation',
      'missing_rollback',
      'unsafe_blast_radius',
      'insufficient_parity',
    ],
    rollbackBehavior: 'partial',
    requiredObservability: [
      'atomic_promotion_evaluated',
      'promotion_blocked',
      'unsafe_stage_transition_detected',
    ],
    requiredParityConfidence: 'MODERATE',
    allowedFlows: 'all',
    forbiddenConditions: ['quarantined dependency', 'CRITICAL blast radius'],
  },
  {
    id: 'STAGE_3_PARTIAL_ATOMIC',
    prerequisites: [
      'pilot stable',
      'parity HIGH',
      'rollback verified',
    ],
    blockers: [
      'forbidden_stage_transition',
      'insufficient_parity',
      'missing_rollback',
      'unsafe_blast_radius',
      'unresolved_drift',
    ],
    rollbackBehavior: 'full',
    requiredObservability: [
      'promotion_confidence_changed',
      'promotion_candidate_ranked',
    ],
    requiredParityConfidence: 'HIGH',
    allowedFlows: 'all',
    forbiddenConditions: [
      'quarantined_dependency',
      'mirror_dependency_unresolved',
    ],
  },
  {
    id: 'STAGE_4_FULL_ATOMIC',
    prerequisites: [
      'partial atomic stable',
      'parity VERY_HIGH',
      'zero drift outstanding',
    ],
    blockers: [
      'quarantined_dependency',
      'unresolved_drift',
      'unsafe_blast_radius',
      'low_migration_confidence',
      'eventual_sync_dependency',
    ],
    rollbackBehavior: 'full',
    requiredObservability: [
      'promotion_confidence_changed',
      'unsafe_stage_transition_detected',
    ],
    requiredParityConfidence: 'VERY_HIGH',
    allowedFlows: 'all',
    forbiddenConditions: ['any CRITICAL blocker', 'quarantine'],
  },
] as const;

export const PROMOTION_STAGE_ORDER: readonly PromotionStageId[] = [
  'STAGE_0_READ_ONLY',
  'STAGE_1_SHADOW_COMPARE',
  'STAGE_2_SOFT_PILOT',
  'STAGE_3_PARTIAL_ATOMIC',
  'STAGE_4_FULL_ATOMIC',
];

export function getStageDescriptor(
  id: PromotionStageId,
): PromotionStageDescriptor | undefined {
  return PROMOTION_STAGES.find((s) => s.id === id);
}

export function stageIndex(id: PromotionStageId): number {
  return PROMOTION_STAGE_ORDER.indexOf(id);
}

export function isMonotonicTransition(
  from: PromotionStageId,
  to: PromotionStageId,
): boolean {
  const a = stageIndex(from);
  const b = stageIndex(to);
  if (a < 0 || b < 0) return false;
  return b === a || b === a + 1;
}

export function nextStage(id: PromotionStageId): PromotionStageId | null {
  const i = stageIndex(id);
  if (i < 0 || i >= PROMOTION_STAGE_ORDER.length - 1) return null;
  return PROMOTION_STAGE_ORDER[i + 1];
}
