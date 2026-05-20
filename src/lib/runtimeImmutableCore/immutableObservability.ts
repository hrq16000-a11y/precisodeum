/**
 * Fase 1.8.8 — Immutable observability (READ-ONLY, PII-free, fail-soft).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type ImmutableAuditAction =
  | 'runtime_immutable_generated'
  | 'runtime_immutable_compromised'
  | 'runtime_immutable_unlock_detected'
  | 'runtime_immutable_invariant_broken'
  | 'runtime_immutable_topology_unstable'
  | 'runtime_immutable_containment_failed'
  | 'runtime_immutable_regression_detected';

export interface ImmutableAuditPayload {
  readonly action: ImmutableAuditAction;
  readonly flow: FlowId;
  readonly metadata: Record<string, string | number | boolean>;
}

const FORBIDDEN_KEYS = [
  'email', 'phone', 'cpf', 'cnpj', 'city', 'address',
  'name', 'full_name', 'fullname',
  'payload', 'raw', 'json', 'url', 'ip',
];

export function isImmutableAuditPayloadPiiFree(p: ImmutableAuditPayload): boolean {
  for (const k of Object.keys(p.metadata)) {
    if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return false;
    const v = p.metadata[k];
    if (typeof v === 'string' && /@|\+\d{8,}|\bhttps?:\/\//i.test(v)) return false;
  }
  return true;
}

export function buildImmutableAuditPayload(
  action: ImmutableAuditAction,
  flow: FlowId,
  metadata: Record<string, string | number | boolean> = {},
): ImmutableAuditPayload {
  const safe: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(metadata)) {
    if (!FORBIDDEN_KEYS.includes(k.toLowerCase())) safe[k] = metadata[k];
  }
  return { action, flow, metadata: safe };
}

export const IMMUTABLE_AUDIT_ACTIONS: readonly ImmutableAuditAction[] = [
  'runtime_immutable_generated',
  'runtime_immutable_compromised',
  'runtime_immutable_unlock_detected',
  'runtime_immutable_invariant_broken',
  'runtime_immutable_topology_unstable',
  'runtime_immutable_containment_failed',
  'runtime_immutable_regression_detected',
] as const;
