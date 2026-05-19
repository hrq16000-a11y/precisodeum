/**
 * Fase 1.7.10 — Cohort strategies (READ-ONLY, declarative).
 *
 * Nenhum cohort real é construído. Não há usuários reais envolvidos.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { getPilotCandidate } from './pilotCandidates';
import type { PilotCohort, PilotRiskLevel } from './pilotTypes';

const UNSAFE_COHORTS_FOR_HIGH_RISK: readonly PilotCohort[] = [
  'low_risk_users',
  'non_provider_only',
];

export function buildCohortStrategy(flow: FlowId): PilotCohort {
  const c = getPilotCandidate(flow);
  if (!c) return 'internal_only';
  if (c.blast === 'CRITICAL') return 'internal_only';
  if (c.risk === 'HIGH') return 'admin_only';
  if (c.risk === 'MEDIUM') return 'safe_boundary_only';
  return 'low_risk_users';
}

export function calculateCohortRisk(cohort: PilotCohort): PilotRiskLevel {
  switch (cohort) {
    case 'internal_only':
      return 'LOW';
    case 'admin_only':
      return 'LOW';
    case 'isolated_region':
      return 'LOW';
    case 'safe_boundary_only':
      return 'MEDIUM';
    case 'provider_shadow_only':
      return 'MEDIUM';
    case 'low_risk_users':
      return 'MEDIUM';
    case 'non_provider_only':
      return 'HIGH';
  }
}

export function detectUnsafeCohort(
  flow: FlowId,
  cohort: PilotCohort,
): boolean {
  const c = getPilotCandidate(flow);
  if (!c) return true;
  if (c.blast === 'CRITICAL' && cohort !== 'internal_only') return true;
  if (c.risk === 'HIGH' && UNSAFE_COHORTS_FOR_HIGH_RISK.includes(cohort)) {
    return true;
  }
  return false;
}
