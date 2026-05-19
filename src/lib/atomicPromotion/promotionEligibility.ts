/**
 * Fase 1.7.8 — Promotion eligibility (READ-ONLY, pure).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import { calculateMigrationConfidence } from '@/lib/atomicSimulation/migrationConfidence';
import { compareLegacyVsAtomic } from '@/lib/atomicSimulation/executionParity';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import type {
  PromotionBlocker,
  PromotionConfidence,
  PromotionEligibility,
} from './promotionTypes';
import { getPromotionRequirements } from './promotionRequirements';

export function calculatePromotionEligibility(
  flow: FlowId,
): PromotionEligibility {
  const requirements = getPromotionRequirements(flow);
  const metCount = requirements.filter((r) => r.met).length;
  return {
    flow,
    requirements,
    metCount,
    totalCount: requirements.length,
    eligible: metCount === requirements.length,
  };
}

export function calculatePromotionConfidence(flow: FlowId): PromotionConfidence {
  const conf = calculateMigrationConfidence(flow);
  if (!conf) return 'NONE';
  // Drift severo penaliza confiança.
  let score = conf.score;
  if (conf.driftRisk === 'HIGH') score -= 15;
  else if (conf.driftRisk === 'MEDIUM') score -= 7;
  if (score >= 90) return 'VERY_HIGH';
  if (score >= 75) return 'HIGH';
  if (score >= 55) return 'MODERATE';
  if (score >= 35) return 'LOW';
  return 'NONE';
}

export function detectPromotionBlockers(flow: FlowId): PromotionBlocker[] {
  const blockers: PromotionBlocker[] = [];
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) {
    blockers.push({
      code: 'simulation_missing',
      detail: 'flow not registered',
      severity: 'CRITICAL',
    });
    return blockers;
  }

  const sim = compareLegacyVsAtomic(flow);
  if (!sim) {
    blockers.push({
      code: 'simulation_missing',
      detail: 'no simulation available',
      severity: 'HIGH',
    });
  } else if (sim.score < 70) {
    blockers.push({
      code: 'insufficient_parity',
      detail: `parity score=${sim.score}`,
      severity: 'HIGH',
    });
  }

  const blast = calculateBlastRadius(flow);
  if (!blast) {
    blockers.push({
      code: 'unsafe_blast_radius',
      detail: 'blast radius unknown',
      severity: 'HIGH',
    });
  } else if (blast.level === 'CRITICAL') {
    blockers.push({
      code: 'unsafe_blast_radius',
      detail: 'blast radius CRITICAL',
      severity: 'CRITICAL',
    });
  }

  if (!getRollbackStrategy(flow)) {
    blockers.push({
      code: 'missing_rollback',
      detail: 'no rollback strategy declared',
      severity: 'HIGH',
    });
  }

  const conf = calculateMigrationConfidence(flow);
  if (conf && conf.score < 55) {
    blockers.push({
      code: 'low_migration_confidence',
      detail: `confidence score=${conf.score}`,
      severity: 'MEDIUM',
    });
  }

  const profile = getFlowDriftProfile(flow);
  if (profile?.depends_on_mirror) {
    blockers.push({
      code: 'mirror_dependency_unresolved',
      detail: 'flow depends on mirror sync',
      severity: 'MEDIUM',
    });
  }
  if (profile?.depends_on_eventual_sync) {
    blockers.push({
      code: 'eventual_sync_dependency',
      detail: 'flow depends on eventual sync',
      severity: 'MEDIUM',
    });
  }

  if (reg.ownership === 'mixed' && reg.dependencies.length > 1) {
    blockers.push({
      code: 'ownership_inconsistent',
      detail: 'mixed ownership across multiple tables',
      severity: 'MEDIUM',
    });
  }

  if (reg.boundary === 'inline_call_site') {
    blockers.push({
      code: 'unsafe_writes_present',
      detail: 'inline call site — quarantined boundary',
      severity: 'HIGH',
    });
  }

  return blockers;
}

export function canPromoteFlow(flow: FlowId): boolean {
  const elig = calculatePromotionEligibility(flow);
  if (!elig.eligible) return false;
  const blockers = detectPromotionBlockers(flow);
  return blockers.every((b) => b.severity !== 'CRITICAL' && b.severity !== 'HIGH');
}

export function explainPromotionEligibility(flow: FlowId): string {
  const elig = calculatePromotionEligibility(flow);
  const conf = calculatePromotionConfidence(flow);
  const blockers = detectPromotionBlockers(flow);
  return `[ELIG] ${flow} met=${elig.metCount}/${elig.totalCount} confidence=${conf} blockers=${blockers.length}`;
}
