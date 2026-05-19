/**
 * Fase 1.7.11 — Governance observability (READ-ONLY, fail-soft, PII-free).
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { GovernanceAuditEnvelope } from './governanceTypes';

export type GovernanceObservabilityAction =
  | 'governance_matrix_generated'
  | 'governance_risk_detected'
  | 'release_freeze_detected'
  | 'unsafe_governance_promotion_detected'
  | 'governance_approval_required'
  | 'rollback_authority_mismatch';

const PII_KEYS = [
  'email',
  'phone',
  'city',
  'cpf',
  'cnpj',
  'url',
  'raw',
  'payload',
  'json',
  'address',
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

export function isGovernancePayloadPiiFree(p: Record<string, unknown>): boolean {
  for (const k of Object.keys(p)) {
    const lk = k.toLowerCase();
    if (PII_KEYS.some((pk) => lk.includes(pk))) return false;
  }
  return true;
}

export async function emitGovernanceEvent(
  action: GovernanceObservabilityAction,
  payload: GovernanceAuditEnvelope,
): Promise<void> {
  try {
    const safe = stripPii(payload as unknown as Record<string, unknown>);
    await logAuditAction({
      action: action as any,
      resource_type: 'atomic_governance',
      resource_id: payload.flow,
      details: safe,
    });
  } catch {
    // fail-soft
  }
}
