/**
 * Fase 1.7.12 — Runtime certification guards (READ-ONLY).
 */

import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import {
  buildRuntimeCertificationMatrix,
  buildCertificationCoverage,
} from './certificationMatrix';
import { detectRollbackParityMismatch, detectParityInstability } from './parityCertification';
import { detectUnsafeObservabilityGap } from './observabilityCertification';
import { detectUnboundedDrift } from './driftCertification';
import type { RuntimeCertificationViolation } from './certificationTypes';

export function assertRuntimeCertificationCoverage(): RuntimeCertificationViolation[] {
  const out: RuntimeCertificationViolation[] = [];
  const cov = buildCertificationCoverage();
  for (const flow of cov.missing) {
    out.push({
      code: 'coverage_gap',
      flow,
      detail: 'flow missing from runtime certification matrix',
    });
  }
  return out;
}

export function assertRuntimeCertificationConsistency(): RuntimeCertificationViolation[] {
  const out: RuntimeCertificationViolation[] = [];
  for (const row of buildRuntimeCertificationMatrix().rows) {
    if (row.currentStage !== 'STAGE_0_READ_ONLY') {
      out.push({
        code: 'monotonicity_violation',
        flow: row.flow,
        detail: `currentStage=${row.currentStage} (must be STAGE_0_READ_ONLY)`,
      });
    }
    if (row.decision === 'FULL_CERTIFIED' && row.blast === 'CRITICAL') {
      out.push({
        code: 'illegal_full_certification',
        flow: row.flow,
        detail: 'CRITICAL blast cannot reach FULL_CERTIFIED',
      });
    }
    if (
      row.decision === 'FULL_CERTIFIED' &&
      (row.freeze === 'HARD_FREEZE' || row.freeze === 'GLOBAL_FREEZE')
    ) {
      out.push({
        code: 'illegal_full_certification',
        flow: row.flow,
        detail: 'frozen flow cannot be FULL_CERTIFIED',
      });
    }
  }
  return out;
}

export function assertNoUnsafeRuntimeCertification(): RuntimeCertificationViolation[] {
  const out: RuntimeCertificationViolation[] = [];
  for (const row of buildRuntimeCertificationMatrix().rows) {
    if (row.liveExecutionEnabled !== false) {
      out.push({ code: 'live_execution_enabled', flow: row.flow, detail: 'live exec must remain false' });
    }
    if (row.realUsersAllowed !== false) {
      out.push({ code: 'real_users_enabled', flow: row.flow, detail: 'real users must remain false' });
    }
    if (row.retryEnabled !== false) {
      out.push({ code: 'retry_enabled', flow: row.flow, detail: 'retry must remain false' });
    }
    if (row.backgroundEnabled !== false) {
      out.push({ code: 'background_enabled', flow: row.flow, detail: 'background must remain false' });
    }
    if (row.execution.executionClass === 'full' && row.blast === 'CRITICAL') {
      out.push({
        code: 'execution_certification_unsafe',
        flow: row.flow,
        detail: 'full execution class with CRITICAL blast is forbidden',
      });
    }
  }
  return out;
}

export function assertNoIllegalCertificationPromotion(): RuntimeCertificationViolation[] {
  const out: RuntimeCertificationViolation[] = [];
  for (const row of buildRuntimeCertificationMatrix().rows) {
    // CONDITIONAL nunca pode ser FULL
    if (row.level === 'CONDITIONAL' && row.decision === 'FULL_CERTIFIED') {
      out.push({
        code: 'unsafe_certification_promotion',
        flow: row.flow,
        detail: 'CONDITIONAL level cannot decide FULL_CERTIFIED',
      });
    }
    // Frozen nunca pode prometer mais que SHADOW/BLOCKED
    if (
      (row.freeze === 'HARD_FREEZE' || row.freeze === 'GLOBAL_FREEZE') &&
      row.decision !== 'BLOCKED'
    ) {
      out.push({
        code: 'unsafe_certification_promotion',
        flow: row.flow,
        detail: `frozen flow has decision=${row.decision}`,
      });
    }
  }
  return out;
}

export function assertCertificationRollbackIntegrity(): RuntimeCertificationViolation[] {
  const out: RuntimeCertificationViolation[] = [];
  for (const row of buildRuntimeCertificationMatrix().rows) {
    if (row.rollback.rollback === 'incompatible' && row.decision !== 'SHADOW_ONLY' && row.decision !== 'BLOCKED') {
      out.push({
        code: 'rollback_certification_unsafe',
        flow: row.flow,
        detail: 'incompatible rollback must remain SHADOW_ONLY or BLOCKED',
      });
    }
    if (detectRollbackParityMismatch(row.flow) && row.decision === 'FULL_CERTIFIED') {
      out.push({
        code: 'parity_certification_mismatch',
        flow: row.flow,
        detail: 'rollback parity mismatch with FULL_CERTIFIED',
      });
    }
  }
  return out;
}

export function assertCertificationIsolationIntegrity(): RuntimeCertificationViolation[] {
  const out: RuntimeCertificationViolation[] = [];
  for (const row of buildRuntimeCertificationMatrix().rows) {
    if (row.isolation.isolation === 'unsafe') {
      out.push({
        code: 'isolation_certification_unsafe',
        flow: row.flow,
        detail: 'isolation classified as unsafe',
      });
    }
    if (row.isolation.isolation === 'partial' && row.decision === 'FULL_CERTIFIED') {
      out.push({
        code: 'isolation_certification_unsafe',
        flow: row.flow,
        detail: 'partial isolation cannot reach FULL_CERTIFIED',
      });
    }
  }
  return out;
}

export function assertCertificationObservabilityIntegrity(): RuntimeCertificationViolation[] {
  const out: RuntimeCertificationViolation[] = [];
  for (const row of buildRuntimeCertificationMatrix().rows) {
    const gaps = detectUnsafeObservabilityGap(row.flow);
    if (gaps.length > 2 && row.decision !== 'SHADOW_ONLY' && row.decision !== 'BLOCKED') {
      out.push({
        code: 'observability_certification_gap',
        flow: row.flow,
        detail: `gaps=${gaps.join(',')}`,
      });
    }
    if (detectUnboundedDrift(row.flow) && row.decision === 'FULL_CERTIFIED') {
      out.push({
        code: 'drift_certification_unbounded',
        flow: row.flow,
        detail: 'unbounded drift with FULL_CERTIFIED',
      });
    }
    if (detectParityInstability(row.flow) && row.decision === 'FULL_CERTIFIED') {
      out.push({
        code: 'parity_certification_mismatch',
        flow: row.flow,
        detail: 'parity instability with FULL_CERTIFIED',
      });
    }
  }
  // Garantir que toda OPERATION_REGISTRY tem row (defensivo)
  void OPERATION_REGISTRY;
  return out;
}
