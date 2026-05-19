/**
 * Fase 1.7.10 — Pilot integrity asserts (READ-ONLY).
 */

import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import { buildPilotMatrix, buildAllPilotPlans } from './pilotMatrix';
import { detectPilotBlockers } from './pilotReadiness';
import { detectUnsafeCohort, buildCohortStrategy } from './cohortStrategies';
import { pilotStageIndex } from './pilotStages';
import type { PilotViolation } from './pilotTypes';

export function assertPilotCoverage(): PilotViolation[] {
  const out: PilotViolation[] = [];
  const matrix = buildPilotMatrix();
  const seen = new Set(matrix.rows.map((r) => r.flow));
  for (const r of OPERATION_REGISTRY) {
    if (!seen.has(r.flow)) {
      out.push({
        code: 'unsafe_pilot_candidate',
        flow: r.flow,
        detail: 'flow missing from pilot matrix',
      });
    }
  }
  return out;
}

export function assertPilotSafety(): PilotViolation[] {
  const out: PilotViolation[] = [];
  for (const plan of buildAllPilotPlans()) {
    if (plan.execution.liveExecutionEnabled !== false) {
      out.push({
        code: 'live_execution_dependency',
        flow: plan.flow,
        detail: 'liveExecutionEnabled must be false',
      });
    }
    if (plan.execution.realUsersAllowed !== false) {
      out.push({
        code: 'unsafe_cohort',
        flow: plan.flow,
        detail: 'realUsersAllowed must be false',
      });
    }
    if (
      plan.safety.blast === 'CRITICAL' &&
      pilotStageIndex(plan.candidate.recommendedStage) >
        pilotStageIndex('STAGE_2_INTERNAL_COMPARE')
    ) {
      out.push({
        code: 'critical_blast_radius',
        flow: plan.flow,
        detail: 'CRITICAL blast cannot exceed INTERNAL_COMPARE',
      });
    }
  }
  return out;
}

export function assertPilotRollbackCoverage(): PilotViolation[] {
  const out: PilotViolation[] = [];
  for (const plan of buildAllPilotPlans()) {
    const stageIdx = pilotStageIndex(plan.candidate.recommendedStage);
    if (
      stageIdx >= pilotStageIndex('STAGE_3_SAFE_COHORT') &&
      plan.candidate.rollback === 'incompatible'
    ) {
      out.push({
        code: 'unsafe_rollout',
        flow: plan.flow,
        detail: 'safe cohort requires compatible rollback',
      });
    }
  }
  return out;
}

export function assertPilotObservabilityCoverage(): PilotViolation[] {
  const out: PilotViolation[] = [];
  for (const plan of buildAllPilotPlans()) {
    if (plan.observability.coverage < 50) {
      out.push({
        code: 'missing_observability',
        flow: plan.flow,
        detail: `coverage=${plan.observability.coverage}`,
      });
    }
  }
  return out;
}

export function assertNoUnsafePilotPromotion(): PilotViolation[] {
  const out: PilotViolation[] = [];
  for (const plan of buildAllPilotPlans()) {
    if (plan.safety.quarantined &&
        pilotStageIndex(plan.candidate.recommendedStage) >
          pilotStageIndex('STAGE_2_INTERNAL_COMPARE')) {
      out.push({
        code: 'quarantined_flow',
        flow: plan.flow,
        detail: 'quarantined flow cannot exceed INTERNAL_COMPARE',
      });
    }
  }
  return out;
}

export function assertNoUnsafeCohort(): PilotViolation[] {
  const out: PilotViolation[] = [];
  for (const plan of buildAllPilotPlans()) {
    const cohort = buildCohortStrategy(plan.flow);
    if (detectUnsafeCohort(plan.flow, cohort)) {
      out.push({
        code: 'unsafe_cohort',
        flow: plan.flow,
        detail: `cohort=${cohort}`,
      });
    }
  }
  return out;
}

export function assertPilotIntegrity(): PilotViolation[] {
  const out: PilotViolation[] = [];
  out.push(...assertPilotCoverage());
  out.push(...assertPilotSafety());
  out.push(...assertPilotRollbackCoverage());
  out.push(...assertPilotObservabilityCoverage());
  out.push(...assertNoUnsafePilotPromotion());
  out.push(...assertNoUnsafeCohort());
  // per-flow structural blockers that should always be detectable
  for (const plan of buildAllPilotPlans()) {
    const blockers = detectPilotBlockers(plan.flow);
    for (const b of blockers) {
      if (
        b.code === 'missing_kill_switch' ||
        b.code === 'missing_abort_strategy'
      ) {
        out.push(b);
      }
    }
  }
  return out;
}
