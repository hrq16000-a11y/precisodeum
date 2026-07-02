/**
 * Fase 1.7.11 — Aggregate governance integrity (READ-ONLY).
 */

import {
  assertGovernanceCoverage,
  assertNoUnsafeGovernancePromotion,
  assertGovernanceConsistency,
  assertNoReleaseFreezeViolation,
  assertNoUnsafeRollbackAuthority,
  assertPromotionRequiresApproval,
} from './governanceGuards';
import type { GovernanceViolation } from './governanceTypes';

export function assertAllGovernanceIntegrity(): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  out.push(...assertGovernanceCoverage());
  out.push(...assertGovernanceConsistency());
  out.push(...assertNoReleaseFreezeViolation());
  out.push(...assertNoUnsafeGovernancePromotion());
  out.push(...assertNoUnsafeRollbackAuthority());
  out.push(...assertPromotionRequiresApproval());
  return out;
}
