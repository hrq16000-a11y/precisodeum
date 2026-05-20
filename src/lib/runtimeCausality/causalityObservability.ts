/**
 * Fase 1.8.3 — Causality observability (READ-ONLY, PII-free).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type CausalityAuditAction =
  | 'runtime_causality_generated'
  | 'runtime_causality_escalated'
  | 'hidden_dependency_cascade_detected'
  | 'recursive_causality_detected'
  | 'circular_causality_detected'
  | 'propagation_depth_increased'
  | 'replay_causality_regressed';

export interface CausalityAuditPayload {
  readonly action: CausalityAuditAction;
  readonly flow: FlowId;
  readonly metadata: Record<string, string | number | boolean>;
}

const FORBIDDEN_KEYS = [
  'email', 'phone', 'cpf', 'cnpj', 'city', 'name', 'full_name', 'fullname',
  'raw', 'payload', 'json', 'url', 'ip', 'address',
];

export function isCausalityAuditPayloadPiiFree(p: CausalityAuditPayload): boolean {
  for (const k of Object.keys(p.metadata)) {
    if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return false;
    const v = p.metadata[k];
    if (typeof v === 'string' && /@|\+\d{8,}|\bhttps?:\/\//i.test(v)) return false;
  }
  return true;
}

export function buildCausalityAuditPayload(
  action: CausalityAuditAction,
  flow: FlowId,
  metadata: Record<string, string | number | boolean> = {},
): CausalityAuditPayload {
  const safe: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(metadata)) {
    if (!FORBIDDEN_KEYS.includes(k.toLowerCase())) safe[k] = metadata[k];
  }
  return { action, flow, metadata: safe };
}

export const CAUSALITY_AUDIT_ACTIONS: readonly CausalityAuditAction[] = [
  'runtime_causality_generated',
  'runtime_causality_escalated',
  'hidden_dependency_cascade_detected',
  'recursive_causality_detected',
  'circular_causality_detected',
  'propagation_depth_increased',
  'replay_causality_regressed',
] as const;
