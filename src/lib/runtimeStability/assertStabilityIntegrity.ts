/**
 * Fase 1.8.4 — Aggregated stability integrity (READ-ONLY).
 */

import type {
  RuntimeStabilityEnvelope,
  RuntimeStabilityViolation,
} from './stabilityTypes';
import type {
  StabilityAuditAction,
  StabilityAuditPayload,
} from './stabilityObservability';
import { STABILITY_AUDIT_ACTIONS } from './stabilityObservability';
import {
  assertCollapseContainment,
  assertConvergenceIntegrity,
  assertDependencyCoverage,
  assertNoCircularDependencyLeaks,
  assertNoEnvelopeOverflow,
  assertNoUnsafeStabilityPromotion,
  assertObservabilityPurity,
} from './stabilityGuards';

export function assertAllStabilityIntegrity(input: {
  envelopes: readonly RuntimeStabilityEnvelope[];
  auditPayloads?: readonly StabilityAuditPayload[];
  allowedAuditActions?: readonly StabilityAuditAction[];
}): RuntimeStabilityViolation[] {
  const out: RuntimeStabilityViolation[] = [];
  for (const e of input.envelopes) {
    out.push(...assertDependencyCoverage(e));
    out.push(...assertNoCircularDependencyLeaks(e));
    out.push(...assertNoEnvelopeOverflow(e));
    out.push(...assertCollapseContainment(e));
    out.push(...assertConvergenceIntegrity(e));
    out.push(...assertNoUnsafeStabilityPromotion(e));
  }
  if (input.auditPayloads && input.auditPayloads.length > 0) {
    out.push(
      ...assertObservabilityPurity(input.auditPayloads, input.allowedAuditActions ?? STABILITY_AUDIT_ACTIONS),
    );
  }
  return out;
}
