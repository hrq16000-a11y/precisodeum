/**
 * Fase 1.8.0 — Runtime recorder observability (PII-free, fail-soft).
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  RuntimeTraceClassification,
  RuntimeTraceSeverity,
  RuntimeWriteTrace,
  TraceConsistencyState,
  TraceOrderingClass,
} from './recorderTypes';

export type RuntimeRecorderObservabilityAction =
  | 'runtime_trace_recorded'
  | 'runtime_trace_failed'
  | 'runtime_trace_divergence_detected'
  | 'runtime_ordering_violation_detected'
  | 'runtime_trace_classified'
  | 'runtime_trace_parity_gap_detected';

const PII_KEYS = [
  'email',
  'phone',
  'cpf',
  'cnpj',
  'city',
  'address',
  'url',
  'raw',
  'payload',
  'json',
  'full_name',
  'name',
];

export interface RuntimeTraceEnvelope {
  source: string;
  flow: FlowId;
  trace_id: string;
  mode: string;
  classification: RuntimeTraceClassification;
  severity: RuntimeTraceSeverity;
  consistency: TraceConsistencyState;
  ordering_class: TraceOrderingClass;
  ordering_violations: number;
  mirror_dependent: boolean;
  orphan_risk: boolean;
  steps: number;
  failed_steps: number;
  live_execution: false;
  retry: false;
  background: false;
  persisted: false;
  real_user_mutation: false;
}

function stripPii<T extends Record<string, unknown>>(p: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    const lk = k.toLowerCase();
    if (PII_KEYS.some((pk) => lk.includes(pk))) continue;
    out[k] = v;
  }
  return out as T;
}

export function isRuntimeRecorderPayloadPiiFree(
  p: Record<string, unknown>,
): boolean {
  for (const k of Object.keys(p)) {
    const lk = k.toLowerCase();
    if (PII_KEYS.some((pk) => lk.includes(pk))) return false;
  }
  return true;
}

export function buildRuntimeTraceEnvelope(
  source: string,
  trace: RuntimeWriteTrace,
): RuntimeTraceEnvelope {
  const failed = trace.steps.filter(
    (s) => s.status === 'failed' || s.status === 'aborted',
  ).length;
  return {
    source,
    flow: trace.flow,
    trace_id: trace.id,
    mode: trace.mode,
    classification: trace.classification,
    severity: trace.severity,
    consistency: trace.consistency,
    ordering_class: trace.ordering.class,
    ordering_violations: trace.ordering.violations.length,
    mirror_dependent: trace.mirrorDependent,
    orphan_risk: trace.orphanRisk,
    steps: trace.steps.length,
    failed_steps: failed,
    live_execution: false,
    retry: false,
    background: false,
    persisted: false,
    real_user_mutation: false,
  };
}

export async function emitRuntimeRecorderEvent(
  action: RuntimeRecorderObservabilityAction,
  envelope: RuntimeTraceEnvelope,
): Promise<void> {
  try {
    const safe = stripPii(envelope as unknown as Record<string, unknown>);
    await logAuditAction({
      action: action as any,
      resource_type: 'runtime_recorder',
      resource_id: envelope.flow,
      details: safe,
    });
  } catch {
    /* fail-soft */
  }
}
