/**
 * Fase 1.8.2 — Replay observability (READ-ONLY, PII-free).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type ReplayAuditAction =
  | 'runtime_replay_generated'
  | 'replay_divergence_detected'
  | 'replay_ordering_regression_detected'
  | 'replay_lineage_broken'
  | 'replay_propagation_risk_detected'
  | 'replay_parity_degraded';

export interface ReplayAuditPayload {
  readonly action: ReplayAuditAction;
  readonly flow: FlowId;
  readonly metadata: Record<string, string | number | boolean>;
}

const FORBIDDEN_KEYS = [
  'email', 'phone', 'cpf', 'cnpj', 'city', 'name', 'full_name', 'fullname',
  'raw', 'payload', 'json', 'url', 'ip', 'address',
];

export function isReplayAuditPayloadPiiFree(p: ReplayAuditPayload): boolean {
  for (const k of Object.keys(p.metadata)) {
    if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return false;
    const v = p.metadata[k];
    if (typeof v === 'string' && /@|\+\d{8,}|\bhttps?:\/\//i.test(v)) return false;
  }
  return true;
}

export function buildReplayAuditPayload(
  action: ReplayAuditAction,
  flow: FlowId,
  metadata: Record<string, string | number | boolean> = {},
): ReplayAuditPayload {
  const safe: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(metadata)) {
    if (!FORBIDDEN_KEYS.includes(k.toLowerCase())) safe[k] = metadata[k];
  }
  return { action, flow, metadata: safe };
}

export const REPLAY_AUDIT_ACTIONS: readonly ReplayAuditAction[] = [
  'runtime_replay_generated',
  'replay_divergence_detected',
  'replay_ordering_regression_detected',
  'replay_lineage_broken',
  'replay_propagation_risk_detected',
  'replay_parity_degraded',
] as const;
