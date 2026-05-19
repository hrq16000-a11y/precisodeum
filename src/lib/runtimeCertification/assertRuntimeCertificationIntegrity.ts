/**
 * Fase 1.7.12 — Aggregate runtime certification integrity (READ-ONLY).
 */

import {
  assertRuntimeCertificationCoverage,
  assertRuntimeCertificationConsistency,
  assertNoUnsafeRuntimeCertification,
  assertNoIllegalCertificationPromotion,
  assertCertificationRollbackIntegrity,
  assertCertificationIsolationIntegrity,
  assertCertificationObservabilityIntegrity,
} from './certificationGuards';
import type { RuntimeCertificationViolation } from './certificationTypes';

export function assertAllRuntimeCertificationIntegrity(): RuntimeCertificationViolation[] {
  const out: RuntimeCertificationViolation[] = [];
  out.push(...assertRuntimeCertificationCoverage());
  out.push(...assertRuntimeCertificationConsistency());
  out.push(...assertNoUnsafeRuntimeCertification());
  out.push(...assertNoIllegalCertificationPromotion());
  out.push(...assertCertificationRollbackIntegrity());
  out.push(...assertCertificationIsolationIntegrity());
  out.push(...assertCertificationObservabilityIntegrity());
  return out;
}
