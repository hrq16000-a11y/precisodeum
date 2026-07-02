/**
 * Fase 1.7.10 — Pilot readiness (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { calculateRpcReadiness } from '@/lib/rpcContracts/rpcReadiness';
import { buildFlowPromotionState } from '@/lib/atomicPromotion/promotionMatrix';
import { calculateMigrationConfidence } from '@/lib/atomicSimulation/migrationConfidence';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import { getPilotCandidate } from './pilotCandidates';
import { buildAbortStrategy } from './abortStrategies';
import { buildKillSwitchPolicy } from './killSwitches';
import {
  buildObservabilityRequirements,
  detectObservabilityGap,
} from './observabilityRequirements';
import type { PilotEligibility, PilotViolation } from './pilotTypes';

export interface PilotReadinessReport {
  flow: FlowId;
  eligibility: PilotEligibility;
  readinessScore: number; // 0..100
  confidence: number; // 0..100
  blockers: PilotViolation[];
  pilotPromotionSupported: boolean;
}

export function detectPilotBlockers(flow: FlowId): PilotViolation[] {
  const out: PilotViolation[] = [];
  const c = getPilotCandidate(flow);
  if (!c) {
    out.push({
      code: 'unsafe_pilot_candidate',
      flow,
      detail: 'no candidate built',
    });
    return out;
  }
  if (c.blast === 'CRITICAL') {
    out.push({
      code: 'critical_blast_radius',
      flow,
      detail: 'CRITICAL blast radius forbids cohort exposure',
    });
  }
  if (c.rollback === 'incompatible') {
    out.push({
      code: 'unsafe_rollout',
      flow,
      detail: 'rollback incompatible',
    });
  }
  if (c.parityScore < 60) {
    out.push({
      code: 'insufficient_parity',
      flow,
      detail: `parity=${c.parityScore}`,
    });
  }
  if (!buildKillSwitchPolicy(flow)) {
    out.push({
      code: 'missing_kill_switch',
      flow,
      detail: 'no kill-switch declared',
    });
  }
  if (!buildAbortStrategy(flow)) {
    out.push({
      code: 'missing_abort_strategy',
      flow,
      detail: 'no abort strategy',
    });
  }
  const gaps = detectObservabilityGap(flow);
  if (gaps.length > 0) {
    out.push({
      code: 'missing_observability',
      flow,
      detail: gaps.join(','),
    });
  }
  return out;
}

export function calculatePilotReadiness(
  flow: FlowId,
): PilotReadinessReport | null {
  const c = getPilotCandidate(flow);
  if (!c) return null;
  const rpc = calculateRpcReadiness(flow);
  const promo = buildFlowPromotionState(flow);
  const conf = calculateMigrationConfidence(flow);
  const blockers = detectPilotBlockers(flow);

  let score = 0;
  score += Math.min(40, Math.round(c.parityScore * 0.4));
  score += rpc ? Math.round(rpc.readinessScore * 0.2) : 0;
  score += conf ? Math.round(conf.score * 0.2) : 0;
  if (c.blast === 'LOW') score += 10;
  else if (c.blast === 'MEDIUM') score += 6;
  else if (c.blast === 'HIGH') score += 2;
  if (c.rollback !== 'incompatible') score += 10;
  score = Math.max(0, Math.min(100, score - blockers.length * 5));

  const pilotPromotionSupported =
    !!rpc &&
    rpc.readinessScore >= 60 &&
    !!promo &&
    promo.maxAllowedStage !== 'STAGE_0_READ_ONLY' &&
    blockers.every((b) => b.code !== 'critical_blast_radius');

  return {
    flow,
    eligibility: c.eligibility,
    readinessScore: score,
    confidence: conf?.score ?? 0,
    blockers,
    pilotPromotionSupported,
  };
}

export function calculatePilotConfidence(flow: FlowId): number {
  return calculatePilotReadiness(flow)?.confidence ?? 0;
}

export function supportsPilotPromotion(flow: FlowId): boolean {
  return calculatePilotReadiness(flow)?.pilotPromotionSupported ?? false;
}

export function explainPilotReadiness(r: PilotReadinessReport): string {
  return `[PILOT/READY] ${r.flow} eligibility=${r.eligibility} score=${r.readinessScore} confidence=${r.confidence} blockers=${r.blockers.length} promotion=${r.pilotPromotionSupported}`;
}

// Calls buildObservabilityRequirements just so consumers can ensure profile exists.
export function ensureObservability(flow: FlowId): boolean {
  return !!buildObservabilityRequirements(flow);
}
