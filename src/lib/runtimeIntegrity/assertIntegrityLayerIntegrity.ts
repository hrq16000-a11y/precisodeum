/**
 * Fase 1.8.5 — Aggregated integrity layer integrity (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  RuntimeIntegrityEnvelope,
  RuntimeIntegrityViolation,
} from './integrityTypes';
import type {
  IntegrityAuditAction,
  IntegrityAuditPayload,
} from './integrityObservability';
import { INTEGRITY_AUDIT_ACTIONS } from './integrityObservability';
import {
  assertContainmentIntegrity,
  assertIntegrityCoverage,
  assertIsolationIntegrity,
  assertNoUnsafeIntegrityPromotion,
  assertObservabilityPurity,
  assertPropagationIntegrity,
  assertTopologyIntegrity,
} from './integrityGuards';

export function assertAllIntegrityLayerIntegrity(input: {
  envelopes: readonly RuntimeIntegrityEnvelope[];
  expectedFlows?: readonly FlowId[];
  auditPayloads?: readonly IntegrityAuditPayload[];
  allowedAuditActions?: readonly IntegrityAuditAction[];
}): RuntimeIntegrityViolation[] {
  const out: RuntimeIntegrityViolation[] = [];
  if (input.expectedFlows && input.expectedFlows.length > 0) {
    out.push(...assertIntegrityCoverage(input.envelopes, input.expectedFlows));
  }
  for (const e of input.envelopes) {
    out.push(...assertContainmentIntegrity(e));
    out.push(...assertIsolationIntegrity(e));
    out.push(...assertPropagationIntegrity(e));
    out.push(...assertTopologyIntegrity(e));
    out.push(...assertNoUnsafeIntegrityPromotion(e));
  }
  if (input.auditPayloads && input.auditPayloads.length > 0) {
    out.push(
      ...assertObservabilityPurity(input.auditPayloads, input.allowedAuditActions ?? INTEGRITY_AUDIT_ACTIONS),
    );
  }
  return out;
}
