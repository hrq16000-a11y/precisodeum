/**
 * Fase 1.7.11 — Rollback authority (READ-ONLY).
 *
 * Determina, de forma puramente declarativa, quem pode promover/abortar/
 * fazer rollback de um flow. Nenhum actor é resolvido em runtime.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import { classifyReleaseRisk, detectReleaseFreeze } from './releaseFreezePolicies';
import type {
  GovernanceRollbackAuthority,
  GovernanceApprovalRequirement,
  GovernanceApprovalState,
} from './governanceTypes';

export function determinePromotionAuthority(
  flow: FlowId,
): GovernanceRollbackAuthority {
  const risk = classifyReleaseRisk(flow);
  if (!risk) return 'governance_board';
  if (risk.critical || risk.blast === 'CRITICAL') return 'governance_board';
  if (risk.risk === 'HIGH') return 'release_manager';
  if (risk.risk === 'MEDIUM') return 'release_manager';
  return 'flow_owner';
}

export function determineAbortAuthority(
  flow: FlowId,
): GovernanceRollbackAuthority {
  const risk = classifyReleaseRisk(flow);
  if (!risk) return 'incident_commander';
  if (risk.critical) return 'incident_commander';
  if (risk.risk === 'HIGH') return 'incident_commander';
  return 'release_manager';
}

export function determineRollbackAuthority(
  flow: FlowId,
): GovernanceRollbackAuthority {
  const risk = classifyReleaseRisk(flow);
  const freeze = detectReleaseFreeze(flow);
  if (freeze.level === 'HARD_FREEZE' || freeze.level === 'GLOBAL_FREEZE') {
    return 'governance_board';
  }
  if (!risk) return 'governance_board';
  if (risk.critical) return 'incident_commander';
  if (risk.risk === 'HIGH') return 'release_manager';
  if (risk.risk === 'MEDIUM') return 'release_manager';
  if (risk.mirrorDependency) return 'release_manager';
  return 'platform_admin';
}


export function buildApprovalRequirement(
  flow: FlowId,
): GovernanceApprovalRequirement {
  const risk = classifyReleaseRisk(flow);
  const freeze = detectReleaseFreeze(flow);
  let state: GovernanceApprovalState = 'not_required';
  if (freeze.level === 'HARD_FREEZE' || freeze.level === 'GLOBAL_FREEZE') {
    state = 'freeze_locked';
  } else if (!risk) {
    state = 'required_governance_board';
  } else if (risk.critical || risk.blast === 'CRITICAL') {
    state = 'required_governance_board';
  } else if (risk.risk === 'HIGH') {
    state = 'required_dual_reviewer';
  } else if (risk.risk === 'MEDIUM') {
    state = 'required_single_reviewer';
  }
  const reviewers =
    state === 'required_governance_board' || state === 'freeze_locked'
      ? 3
      : state === 'required_dual_reviewer'
      ? 2
      : state === 'required_single_reviewer'
      ? 1
      : 0;
  return {
    flow,
    state,
    reviewers,
    requiresGovernanceBoard:
      state === 'required_governance_board' || state === 'freeze_locked',
    requiresIncidentCommander:
      !!risk?.critical || risk?.risk === 'HIGH' || freeze.level !== 'NONE',
    rationale: `freeze=${freeze.level} risk=${risk?.risk ?? 'UNKNOWN'} blast=${
      risk?.blast ?? 'UNKNOWN'
    }`,
  };
}

export function authorityIsConsistent(flow: FlowId): boolean {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return false;
  const promote = determinePromotionAuthority(flow);
  const abort = determineAbortAuthority(flow);
  const rollback = determineRollbackAuthority(flow);
  // promote authority must NEVER exceed rollback authority hierarchy
  const HIERARCHY: GovernanceRollbackAuthority[] = [
    'flow_owner',
    'platform_admin',
    'release_manager',
    'incident_commander',
    'governance_board',
  ];
  const idx = (a: GovernanceRollbackAuthority) => HIERARCHY.indexOf(a);
  if (idx(promote) > idx(rollback)) return false;
  if (idx(abort) > idx(rollback) + 1) return false;
  return true;
}
