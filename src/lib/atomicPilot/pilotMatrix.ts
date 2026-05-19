/**
 * Fase 1.7.10 — Pilot matrix (READ-ONLY).
 *
 * Cada flow recebe APENAS uma recomendação. Nenhum estado real muda.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import {
  buildPilotCandidates,
  getPilotCandidate,
} from './pilotCandidates';
import { buildRolloutStrategy } from './rolloutStrategies';
import { buildAbortStrategy } from './abortStrategies';
import { buildObservabilityRequirements } from './observabilityRequirements';
import { buildKillSwitchPolicy } from './killSwitches';
import { buildCohortStrategy } from './cohortStrategies';
import { calculatePilotReadiness } from './pilotReadiness';
import { pilotStageIndex } from './pilotStages';
import type {
  AtomicPilotPlan,
  PilotDecision,
  PilotMatrix,
  PilotMatrixRow,
} from './pilotTypes';

function decisionFor(
  recommendedStageIdx: number,
  eligibility: string,
  blockerCount: number,
): PilotDecision {
  if (eligibility === 'BLOCKED') return 'BLOCKED';
  if (eligibility === 'NOT_ELIGIBLE') return 'HOLD';
  if (blockerCount > 0 && eligibility === 'CONDITIONAL') return 'KEEP_SHADOW';
  switch (recommendedStageIdx) {
    case 0:
      return 'HOLD';
    case 1:
      return 'KEEP_SHADOW';
    case 2:
      return 'ADVANCE_INTERNAL_COMPARE';
    case 3:
      return 'ADVANCE_SAFE_COHORT';
    case 4:
      return 'ADVANCE_LIMITED_PRODUCTION';
    case 5:
      return 'ADVANCE_FULL_PROMOTION';
    default:
      return 'HOLD';
  }
}

export function buildPilotPlan(flow: FlowId): AtomicPilotPlan | null {
  const c = getPilotCandidate(flow);
  if (!c) return null;
  const rollout = buildRolloutStrategy(flow);
  const abort = buildAbortStrategy(flow);
  const observability = buildObservabilityRequirements(flow);
  const kill = buildKillSwitchPolicy(flow);
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!rollout || !abort || !observability || !kill || !reg) return null;

  const decision = decisionFor(
    pilotStageIndex(c.recommendedStage),
    c.eligibility,
    c.blockerCount,
  );

  return {
    flow,
    candidate: c,
    safety: {
      flow,
      rollback: c.rollback,
      rollbackStrategy: null,
      risk: c.risk,
      blast: c.blast,
      parityScore: c.parityScore,
      driftSeverity: 'NONE',
      mirrorDependency: reg.boundary === 'multiWriteSync',
      quarantined: reg.boundary === 'inline_call_site',
    },
    rollout,
    abort,
    observability,
    execution: {
      flow,
      mode: 'read_only',
      liveExecutionEnabled: false,
      realUsersAllowed: false,
      shadowOnly: true,
      requiresPromotionApproval: true,
    },
    killSwitch: kill,
    decision,
  };
}

export function buildPilotMatrix(): PilotMatrix {
  const rows: PilotMatrixRow[] = [];
  for (const c of buildPilotCandidates()) {
    const plan = buildPilotPlan(c.flow);
    if (!plan) continue;
    rows.push({
      flow: c.flow,
      eligible: c.eligibility === 'READY' || c.eligibility === 'CONDITIONAL',
      recommendedStage: c.recommendedStage,
      rolloutClass: plan.rollout.policy,
      rollbackClass: c.rollback,
      observabilityLevel: plan.observability.level,
      blastRadius: c.blast,
      promotionStage: c.promotion,
      cohort: buildCohortStrategy(c.flow),
      abortSensitivity: plan.killSwitch.sensitivity,
      decision: plan.decision,
    });
  }
  const totals = {
    flows: rows.length,
    ready: rows.filter((r) => r.eligible && r.decision !== 'KEEP_SHADOW' && r.decision !== 'HOLD' && r.decision !== 'BLOCKED').length,
    conditional: rows.filter((r) => r.decision === 'KEEP_SHADOW').length,
    blocked: rows.filter((r) => r.decision === 'BLOCKED').length,
    notEligible: rows.filter((r) => r.decision === 'HOLD').length,
  };
  return { rows, totals };
}

export function summarizePilotReadiness(): string {
  const m = buildPilotMatrix();
  return `[PILOT] flows=${m.totals.flows} ready=${m.totals.ready} conditional=${m.totals.conditional} blocked=${m.totals.blocked} hold=${m.totals.notEligible}`;
}

export function rankPilotRolloutOrder(): FlowId[] {
  return buildPilotMatrix()
    .rows.slice()
    .sort((a, b) => {
      const blastOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
      const ba = blastOrder[a.blastRadius];
      const bb = blastOrder[b.blastRadius];
      if (ba !== bb) return ba - bb;
      const sa = pilotStageIndex(a.recommendedStage);
      const sb = pilotStageIndex(b.recommendedStage);
      return sb - sa;
    })
    .map((r) => r.flow);
}

export function buildAllPilotPlans(): AtomicPilotPlan[] {
  const out: AtomicPilotPlan[] = [];
  for (const c of buildPilotCandidates()) {
    const p = buildPilotPlan(c.flow);
    if (p) out.push(p);
  }
  return out;
}

export function calculatePilotReadinessSummary() {
  return buildPilotCandidates().map((c) => calculatePilotReadiness(c.flow));
}
