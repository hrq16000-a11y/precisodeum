/**
 * Fase 1.7.12 — Runtime certification observability (READ-ONLY, PII-free, fail-soft).
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { RuntimeCertificationEnvelope } from './certificationTypes';

export type RuntimeCertificationObservabilityAction =
  | 'runtime_certification_generated'
  | 'runtime_certification_failed'
  | 'runtime_certification_risk_detected'
  | 'parity_certification_changed'
  | 'rollback_certification_blocked'
  | 'observability_certification_gap'
  | 'drift_certification_degraded';

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

function stripPii<T extends Record<string, unknown>>(p: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    const lk = k.toLowerCase();
    if (PII_KEYS.some((pk) => lk.includes(pk))) continue;
    out[k] = v;
  }
  return out as T;
}

export function isRuntimeCertificationPayloadPiiFree(
  p: Record<string, unknown>,
): boolean {
  for (const k of Object.keys(p)) {
    const lk = k.toLowerCase();
    if (PII_KEYS.some((pk) => lk.includes(pk))) return false;
  }
  return true;
}

export async function emitRuntimeCertificationEvent(
  action: RuntimeCertificationObservabilityAction,
  payload: RuntimeCertificationEnvelope,
): Promise<void> {
  try {
    const safe = stripPii(payload as unknown as Record<string, unknown>);
    await logAuditAction({
      action: action as any,
      resource_type: 'runtime_certification',
      resource_id: payload.flow,
      details: safe,
    });
  } catch {
    // fail-soft
  }
}
