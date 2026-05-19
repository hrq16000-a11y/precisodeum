/**
 * Fase 1.7.10 — Pilot stages pipeline (READ-ONLY).
 */

import type { AtomicPilotStage } from './pilotTypes';

export interface PilotStageDescriptor {
  id: AtomicPilotStage;
  prerequisites: string[];
  blockers: string[];
  requiredTelemetry: string[];
  requiredParity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  allowedFlows: 'all' | 'safe_only';
  rollbackPolicy: 'none' | 'partial' | 'full';
  killSwitchBehavior: 'inert' | 'manual' | 'armed';
  abortConditions: string[];
}

export const PILOT_STAGES: readonly PilotStageDescriptor[] = [
  {
    id: 'STAGE_0_DISABLED',
    prerequisites: ['flow registered'],
    blockers: ['simulation_missing'],
    requiredTelemetry: [],
    requiredParity: 'NONE',
    allowedFlows: 'all',
    rollbackPolicy: 'none',
    killSwitchBehavior: 'inert',
    abortConditions: ['any', 'unsafe_pilot_candidate'],
  },
  {
    id: 'STAGE_1_INTERNAL_SHADOW',
    prerequisites: ['simulation coverage'],
    blockers: ['simulation_missing'],
    requiredTelemetry: ['atomic_simulation_generated'],
    requiredParity: 'LOW',
    allowedFlows: 'all',
    rollbackPolicy: 'none',
    killSwitchBehavior: 'manual',
    abortConditions: ['parity_regression', 'unsafe_promotion'],
  },
  {
    id: 'STAGE_2_INTERNAL_COMPARE',
    prerequisites: ['shadow validated', 'parity matrix'],
    blockers: ['insufficient_parity'],
    requiredTelemetry: ['divergence_detected', 'parity_regression_detected'],
    requiredParity: 'MEDIUM',
    allowedFlows: 'all',
    rollbackPolicy: 'none',
    killSwitchBehavior: 'manual',
    abortConditions: ['drift_explosion', 'mirror_inconsistency'],
  },
  {
    id: 'STAGE_3_SAFE_COHORT',
    prerequisites: ['rollback verified', 'observability HIGH', 'cohort isolated'],
    blockers: [
      'quarantined_flow',
      'unsafe_blast_radius',
      'missing_rollback',
      'unsafe_cohort',
    ],
    requiredTelemetry: ['rollback_simulation_failed', 'blast_radius_changed'],
    requiredParity: 'HIGH',
    allowedFlows: 'safe_only',
    rollbackPolicy: 'partial',
    killSwitchBehavior: 'armed',
    abortConditions: ['blast_escalation', 'rollback_failure', 'orphan_emergence'],
  },
  {
    id: 'STAGE_4_LIMITED_PRODUCTION',
    prerequisites: ['safe cohort stable', 'parity HIGH'],
    blockers: [
      'quarantined_flow',
      'critical_blast_radius',
      'unsafe_promotion',
    ],
    requiredTelemetry: [
      'rpc_readiness_changed',
      'promotion_confidence_changed',
    ],
    requiredParity: 'HIGH',
    allowedFlows: 'safe_only',
    rollbackPolicy: 'full',
    killSwitchBehavior: 'armed',
    abortConditions: ['stale_read_spike', 'mirror_inconsistency'],
  },
  {
    id: 'STAGE_5_FULL_PROMOTION',
    prerequisites: ['limited production stable', 'parity VERY_HIGH'],
    blockers: [
      'quarantined_flow',
      'critical_blast_radius',
      'live_execution_dependency',
      'unsafe_promotion',
    ],
    requiredTelemetry: [
      'atomic_pilot_candidate_detected',
      'pilot_readiness_changed',
    ],
    requiredParity: 'VERY_HIGH',
    allowedFlows: 'safe_only',
    rollbackPolicy: 'full',
    killSwitchBehavior: 'armed',
    abortConditions: ['any CRITICAL trigger'],
  },
] as const;

export const PILOT_STAGE_ORDER: readonly AtomicPilotStage[] = [
  'STAGE_0_DISABLED',
  'STAGE_1_INTERNAL_SHADOW',
  'STAGE_2_INTERNAL_COMPARE',
  'STAGE_3_SAFE_COHORT',
  'STAGE_4_LIMITED_PRODUCTION',
  'STAGE_5_FULL_PROMOTION',
];

export function pilotStageIndex(id: AtomicPilotStage): number {
  return PILOT_STAGE_ORDER.indexOf(id);
}

export function isMonotonicPilotTransition(
  from: AtomicPilotStage,
  to: AtomicPilotStage,
): boolean {
  const a = pilotStageIndex(from);
  const b = pilotStageIndex(to);
  if (a < 0 || b < 0) return false;
  return b === a || b === a + 1;
}

export function getPilotStageDescriptor(
  id: AtomicPilotStage,
): PilotStageDescriptor | undefined {
  return PILOT_STAGES.find((s) => s.id === id);
}
