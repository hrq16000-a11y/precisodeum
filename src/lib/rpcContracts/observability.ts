/**
 * Fase 1.7.9 — RPC observability (READ-ONLY, fail-soft, PII-free).
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  RpcCompatibilityLevel,
  RpcContractViolationCode,
  RpcStrength,
} from './rpcContractTypes';

export type RpcObservabilityAction =
  | 'rpc_contract_generated'
  | 'rpc_contract_blocked'
  | 'rpc_readiness_changed'
  | 'rpc_payload_risk_detected'
  | 'rpc_rollback_incompatible'
  | 'rpc_idempotency_risk_detected';

export interface RpcEventPayload {
  source: string;
  rpc: string;
  flow: FlowId;
  readiness_score?: number;
  compatibility?: RpcCompatibilityLevel;
  rollback_strength?: RpcStrength;
  consistency_strength?: RpcStrength;
  blocker_count?: number;
  violation_code?: RpcContractViolationCode;
  execution_mode: 'read_only' | 'shadow' | 'pilot' | 'soft' | 'full';
}

const PII_KEYS = [
  'email',
  'phone',
  'city',
  'cpf',
  'cnpj',
  'url',
  'raw',
  'payload',
  'json_dump',
  'dump',
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

export function isRpcPayloadPiiFree(p: Record<string, unknown>): boolean {
  for (const k of Object.keys(p)) {
    const lk = k.toLowerCase();
    if (PII_KEYS.some((pk) => lk.includes(pk))) return false;
  }
  return true;
}

export async function emitRpcContractEvent(
  action: RpcObservabilityAction,
  payload: RpcEventPayload,
): Promise<void> {
  try {
    const safe = stripPii(payload as unknown as Record<string, unknown>);
    await logAuditAction({
      action,
      resource_type: 'rpc_contract',
      resource_id: payload.rpc,
      details: safe,
    });
  } catch {
    // fail-soft
  }
}
