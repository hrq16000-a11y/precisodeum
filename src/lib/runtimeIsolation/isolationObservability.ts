/**
 * Fase 1.8.6 — Isolation observability (READ-ONLY, PII-free, fail-soft).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type IsolationAuditAction =
  | 'runtime_isolation_generated'
  | 'runtime_isolation_leak_detected'
  | 'runtime_isolation_collapsed'
  | 'runtime_isolation_boundary_shared'
  | 'runtime_isolation_recursion_detected'
  | 'runtime_isolation_certification_failed'
  | 'runtime_isolation_topology_overlap';

export interface IsolationAuditPayload {
  readonly action: IsolationAuditAction;
  readonly flow: FlowId;
  readonly metadata: Record<string, string | number | boolean>;
}

const FORBIDDEN_KEYS = [
  'email', 'phone', 'cpf', 'cnpj', 'city', 'address',
  'name', 'full_name', 'fullname',
  'payload', 'raw', 'json', 'url', 'ip',
];

export function isIsolationAuditPayloadPiiFree(p: IsolationAuditPayload): boolean {
  for (const k of Object.keys(p.metadata)) {
    if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return false;
    const v = p.metadata[k];
    if (typeof v === 'string' && /@|\+\d{8,}|\bhttps?:\/\//i.test(v)) return false;
  }
  return true;
}

export function buildIsolationAuditPayload(
  action: IsolationAuditAction,
  flow: FlowId,
  metadata: Record<string, string | number | boolean> = {},
): IsolationAuditPayload {
  const safe: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(metadata)) {
    if (!FORBIDDEN_KEYS.includes(k.toLowerCase())) safe[k] = metadata[k];
  }
  return { action, flow, metadata: safe };
}

export const ISOLATION_AUDIT_ACTIONS: readonly IsolationAuditAction[] = [
  'runtime_isolation_generated',
  'runtime_isolation_leak_detected',
  'runtime_isolation_collapsed',
  'runtime_isolation_boundary_shared',
  'runtime_isolation_recursion_detected',
  'runtime_isolation_certification_failed',
  'runtime_isolation_topology_overlap',
] as const;
