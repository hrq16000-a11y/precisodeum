/**
 * Fase 1.7.11 — Governance guards (READ-ONLY).
 *
 * Asserts puros sobre o estado declarativo. Nunca tocam runtime.
 */

import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import { buildGovernanceMatrix, buildGovernanceState } from './governanceMatrix';
import {
  detectUnsafePromotionWindow,
  requiresGovernanceApproval,
} from './releaseFreezePolicies';
import { authorityIsConsistent } from './rollbackAuthority';
import type { GovernanceViolation } from './governanceTypes';

export function assertGovernanceCoverage(): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const m = buildGovernanceMatrix();
  const seen = new Set(m.rows.map((r) => r.flow));
  for (const r of OPERATION_REGISTRY) {
    if (!seen.has(r.flow)) {
      out.push({
        code: 'coverage_gap',
        flow: r.flow,
        detail: 'flow missing from governance matrix',
      });
    }
  }
  return out;
}

export function assertNoUnsafeGovernancePromotion(): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  for (const row of buildGovernanceMatrix().rows) {
    if (detectUnsafePromotionWindow(row.flow)) {
      out.push({
        code: 'unsafe_promotion',
        flow: row.flow,
        detail: `freeze=${row.freeze.level} maxAllowed=${row.promotionGuard.maxAllowedStage}`,
      });
    }
    if (row.promotionGuard.liveExecutionEnabled !== false) {
      out.push({
        code: 'live_execution_enabled',
        flow: row.flow,
        detail: 'live execution must remain false',
      });
    }
    if (row.promotionGuard.realUsersAllowed !== false) {
      out.push({
        code: 'real_users_enabled',
        flow: row.flow,
        detail: 'real users must remain false',
      });
    }
    if (row.promotionGuard.retryEnabled !== false) {
      out.push({
        code: 'retry_enabled',
        flow: row.flow,
        detail: 'retry must remain false',
      });
    }
  }
  return out;
}

export function assertGovernanceConsistency(): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  for (const row of buildGovernanceMatrix().rows) {
    // currentStage SEMPRE STAGE_0_READ_ONLY nesta fase
    if (row.promotionGuard.currentStage !== 'STAGE_0_READ_ONLY') {
      out.push({
        code: 'forbidden_stage_transition',
        flow: row.flow,
        detail: `currentStage=${row.promotionGuard.currentStage}`,
      });
    }
    // monotonicidade: max >= current (sempre verdade em read-only)
    if (
      row.promotionGuard.maxAllowedStage === 'STAGE_4_FULL_ATOMIC' &&
      row.freeze.level !== 'NONE'
    ) {
      out.push({
        code: 'monotonicity_violation',
        flow: row.flow,
        detail: 'FULL_ATOMIC cannot coexist with active freeze',
      });
    }
  }
  return out;
}

export function assertNoReleaseFreezeViolation(): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  for (const row of buildGovernanceMatrix().rows) {
    if (
      (row.freeze.level === 'HARD_FREEZE' ||
        row.freeze.level === 'GLOBAL_FREEZE') &&
      row.promotionGuard.maxAllowedStage !== 'STAGE_0_READ_ONLY'
    ) {
      out.push({
        code: 'freeze_violation',
        flow: row.flow,
        detail: `hard freeze must cap maxAllowed at STAGE_0_READ_ONLY (got ${row.promotionGuard.maxAllowedStage})`,
      });
    }
    if (
      row.freeze.level === 'PARTIAL_FREEZE' &&
      row.promotionGuard.maxAllowedStage !== 'STAGE_0_READ_ONLY' &&
      row.promotionGuard.maxAllowedStage !== 'STAGE_1_SHADOW_COMPARE'
    ) {
      out.push({
        code: 'freeze_violation',
        flow: row.flow,
        detail: `partial freeze must cap maxAllowed at SHADOW_COMPARE (got ${row.promotionGuard.maxAllowedStage})`,
      });
    }
    if (row.releaseWindow.state === 'frozen' && row.decision !== 'FROZEN') {
      out.push({
        code: 'rollout_window_violation',
        flow: row.flow,
        detail: `release window frozen but decision=${row.decision}`,
      });
    }
  }
  return out;
}

export function assertNoUnsafeRollbackAuthority(): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  for (const row of buildGovernanceMatrix().rows) {
    if (!authorityIsConsistent(row.flow)) {
      out.push({
        code: 'rollback_authority_mismatch',
        flow: row.flow,
        detail: `rollback=${row.rollbackAuthority}`,
      });
    }
  }
  return out;
}

export function assertPromotionRequiresApproval(): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  for (const row of buildGovernanceMatrix().rows) {
    if (
      requiresGovernanceApproval(row.flow) &&
      row.approval.state === 'not_required'
    ) {
      out.push({
        code: 'missing_approval_requirement',
        flow: row.flow,
        detail: 'governance approval required but state=not_required',
      });
    }
  }
  return out;
}
