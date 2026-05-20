/**
 * Fase 1.8.7 — Enforcement observability (READ-ONLY, PII-free, fail-soft).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type EnforcementAuditAction =
  | 'runtime_enforcement_generated'
  | 'runtime_enforcement_blocked'
  | 'runtime_lockdown_triggered'
  | 'runtime_boundary_escape_detected'
  | 'runtime_dependency_violation_detected'
  | 'runtime_topology_violation_detected'
  | 'runtime_enforcement_collapsed';

export interface EnforcementAuditPayload {
  readonly action: EnforcementAuditAction;
  readonly flow: FlowId;
  readonly metadata: Record<string, string | number | boolean>;
}

const FORBIDDEN_KEYS = [
  'email', 'phone', 'cpf', 'cnpj', 'city', 'address',
  'name', 'full_name', 'fullname',
  'payload', 'raw', 'json', 'url', 'ip',
];

export function isEnforcementAuditPayloadPiiFree(p: EnforcementAuditPayload): boolean {
  for (const k of Object.keys(p.metadata)) {
    if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return false;
    const v = p.metadata[k];
    if (typeof v === 'string' && /@|\+\d{8,}|\bhttps?:\/\//i.test(v)) return false;
  }
  return true;
}

export function buildEnforcementAuditPayload(
  action: EnforcementAuditAction,
  flow: FlowId,
  metadata: Record<string, string | number | boolean> = {},
): EnforcementAuditPayload {
  const safe: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(metadata)) {
    if (!FORBIDDEN_KEYS.includes(k.toLowerCase())) safe[k] = metadata[k];
  }
  return { action, flow, metadata: safe };
}

export const ENFORCEMENT_AUDIT_ACTIONS: readonly EnforcementAuditAction[] = [
  'runtime_enforcement_generated',
  'runtime_enforcement_blocked',
  'runtime_lockdown_triggered',
  'runtime_boundary_escape_detected',
  'runtime_dependency_violation_detected',
  'runtime_topology_violation_detected',
  'runtime_enforcement_collapsed',
] as const;
