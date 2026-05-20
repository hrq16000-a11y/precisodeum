/**
 * Fase 1.8.6 — Aggregator guard (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  IsolationCertification,
  IsolationEnvelope,
  IsolationViolation,
} from './isolationTypes';
import type {
  IsolationAuditAction,
  IsolationAuditPayload,
} from './isolationObservability';
import {
  assertIsolationCertificationIntegrity,
  assertIsolationContainment,
  assertIsolationCoverage,
  assertIsolationObservabilityPurity,
  assertIsolationReadOnlyInvariant,
  assertIsolationTopologyIntegrity,
} from './isolationGuards';

export interface AssertAllInput {
  readonly envelopes: readonly IsolationEnvelope[];
  readonly expectedFlows?: readonly FlowId[];
  readonly certifications?: readonly IsolationCertification[];
  readonly payloads?: readonly IsolationAuditPayload[];
  readonly allowedActions?: readonly IsolationAuditAction[];
}

export function assertAllIsolationIntegrity(input: AssertAllInput): IsolationViolation[] {
  const out: IsolationViolation[] = [];
  if (input.expectedFlows) out.push(...assertIsolationCoverage(input.envelopes, input.expectedFlows));
  for (const e of input.envelopes) {
    out.push(...assertIsolationReadOnlyInvariant(e));
    out.push(...assertIsolationContainment(e));
    out.push(...assertIsolationTopologyIntegrity(e));
  }
  if (input.certifications) out.push(...assertIsolationCertificationIntegrity(input.certifications));
  if (input.payloads && input.allowedActions) {
    out.push(...assertIsolationObservabilityPurity(input.payloads, input.allowedActions));
  }
  return out;
}
