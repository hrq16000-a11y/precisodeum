/**
 * Fase 1.8.5 — Integrity observability (READ-ONLY, PII-free, fail-soft).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type IntegrityAuditAction =
  | 'runtime_integrity_generated'
  | 'integrity_containment_failed'
  | 'integrity_isolation_leaked'
  | 'integrity_propagation_detected'
  | 'systemic_integrity_degraded'
  | 'cross_layer_integrity_gap_detected'
  | 'runtime_integrity_collapsed';

export interface IntegrityAuditPayload {
  readonly action: IntegrityAuditAction;
  readonly flow: FlowId;
  readonly metadata: Record<string, string | number | boolean>;
}

const FORBIDDEN_KEYS = [
  'email', 'phone', 'cpf', 'cnpj', 'city', 'name', 'full_name', 'fullname',
  'raw', 'payload', 'json', 'url', 'ip', 'address',
];

export function isIntegrityAuditPayloadPiiFree(p: IntegrityAuditPayload): boolean {
  for (const k of Object.keys(p.metadata)) {
    if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return false;
    const v = p.metadata[k];
    if (typeof v === 'string' && /@|\+\d{8,}|\bhttps?:\/\//i.test(v)) return false;
  }
  return true;
}

export function buildIntegrityAuditPayload(
  action: IntegrityAuditAction,
  flow: FlowId,
  metadata: Record<string, string | number | boolean> = {},
): IntegrityAuditPayload {
  const safe: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(metadata)) {
    if (!FORBIDDEN_KEYS.includes(k.toLowerCase())) safe[k] = metadata[k];
  }
  return { action, flow, metadata: safe };
}

export const INTEGRITY_AUDIT_ACTIONS: readonly IntegrityAuditAction[] = [
  'runtime_integrity_generated',
  'integrity_containment_failed',
  'integrity_isolation_leaked',
  'integrity_propagation_detected',
  'systemic_integrity_degraded',
  'cross_layer_integrity_gap_detected',
  'runtime_integrity_collapsed',
] as const;
