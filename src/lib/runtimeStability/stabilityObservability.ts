/**
 * Fase 1.8.4 — Stability observability (READ-ONLY, PII-free, fail-soft).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type StabilityAuditAction =
  | 'runtime_stability_generated'
  | 'dependency_resolution_failed'
  | 'collapse_risk_detected'
  | 'convergence_regressed'
  | 'propagation_envelope_overflow'
  | 'isolation_boundary_leaked'
  | 'runtime_divergence_detected';

export interface StabilityAuditPayload {
  readonly action: StabilityAuditAction;
  readonly flow: FlowId;
  readonly metadata: Record<string, string | number | boolean>;
}

const FORBIDDEN_KEYS = [
  'email', 'phone', 'cpf', 'cnpj', 'city', 'name', 'full_name', 'fullname',
  'raw', 'payload', 'json', 'url', 'ip', 'address',
];

export function isStabilityAuditPayloadPiiFree(p: StabilityAuditPayload): boolean {
  for (const k of Object.keys(p.metadata)) {
    if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return false;
    const v = p.metadata[k];
    if (typeof v === 'string' && /@|\+\d{8,}|\bhttps?:\/\//i.test(v)) return false;
  }
  return true;
}

export function buildStabilityAuditPayload(
  action: StabilityAuditAction,
  flow: FlowId,
  metadata: Record<string, string | number | boolean> = {},
): StabilityAuditPayload {
  const safe: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(metadata)) {
    if (!FORBIDDEN_KEYS.includes(k.toLowerCase())) safe[k] = metadata[k];
  }
  return { action, flow, metadata: safe };
}

export const STABILITY_AUDIT_ACTIONS: readonly StabilityAuditAction[] = [
  'runtime_stability_generated',
  'dependency_resolution_failed',
  'collapse_risk_detected',
  'convergence_regressed',
  'propagation_envelope_overflow',
  'isolation_boundary_leaked',
  'runtime_divergence_detected',
] as const;
