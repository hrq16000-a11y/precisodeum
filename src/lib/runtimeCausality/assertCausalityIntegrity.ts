/**
 * Fase 1.8.3 — Aggregated causality integrity (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  CausalityAuditAction,
  CausalityAuditPayload,
} from './causalityObservability';
import { CAUSALITY_AUDIT_ACTIONS } from './causalityObservability';
import type {
  RuntimeCausalityGraph,
  RuntimeCausalityViolation,
} from './causalityTypes';
import {
  assertCausalityCoverage,
  assertDriftContainment,
  assertNoCircularCausalityLeaks,
  assertNoUnsafeCausalityPromotion,
  assertNoUnsafePropagation,
  assertObservabilityPurity,
  assertReplayCausalityIntegrity,
} from './causalityGuards';

export function assertAllCausalityIntegrity(input: {
  graphs: readonly RuntimeCausalityGraph[];
  expectedFlows?: readonly FlowId[];
  auditPayloads?: readonly CausalityAuditPayload[];
  allowedAuditActions?: readonly CausalityAuditAction[];
}): RuntimeCausalityViolation[] {
  const out: RuntimeCausalityViolation[] = [];
  if (input.expectedFlows && input.expectedFlows.length > 0) {
    out.push(...assertCausalityCoverage(input.graphs, input.expectedFlows));
  }
  for (const g of input.graphs) {
    out.push(...assertNoCircularCausalityLeaks(g));
    out.push(...assertNoUnsafePropagation(g));
    out.push(...assertReplayCausalityIntegrity(g));
    out.push(...assertDriftContainment(g));
    out.push(...assertNoUnsafeCausalityPromotion(g));
  }
  if (input.auditPayloads && input.auditPayloads.length > 0) {
    out.push(
      ...assertObservabilityPurity(input.auditPayloads, input.allowedAuditActions ?? CAUSALITY_AUDIT_ACTIONS),
    );
  }
  return out;
}
