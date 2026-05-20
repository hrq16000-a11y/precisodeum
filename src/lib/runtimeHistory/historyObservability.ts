/**
 * Fase 1.8.1 — History observability (READ-ONLY, PII-free).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';

export type HistoryAuditAction =
  | 'runtime_history_generated'
  | 'runtime_history_regression_detected'
  | 'runtime_lineage_broken'
  | 'runtime_propagation_risk_detected'
  | 'temporal_consistency_degraded'
  | 'runtime_trend_changed'
  | 'historical_parity_gap_detected';

export interface HistoryAuditPayload {
  readonly action: HistoryAuditAction;
  readonly flow: FlowId;
  readonly metadata: Record<string, string | number | boolean>;
}

const FORBIDDEN_KEYS = [
  'email', 'phone', 'cpf', 'cnpj', 'city', 'full_name', 'fullName',
  'name', 'raw', 'payload', 'json', 'url', 'address', 'ip',
];

export function isHistoryAuditPayloadPiiFree(p: HistoryAuditPayload): boolean {
  for (const k of Object.keys(p.metadata)) {
    if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return false;
    const v = p.metadata[k];
    if (typeof v === 'string' && /@|\+\d{8,}|\bhttps?:\/\//i.test(v)) return false;
  }
  return true;
}

export function buildHistoryAuditPayload(
  action: HistoryAuditAction,
  flow: FlowId,
  metadata: Record<string, string | number | boolean> = {},
): HistoryAuditPayload {
  const safe: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(metadata)) {
    if (!FORBIDDEN_KEYS.includes(k.toLowerCase())) safe[k] = metadata[k];
  }
  return { action, flow, metadata: safe };
}

export const HISTORY_AUDIT_ACTIONS: readonly HistoryAuditAction[] = [
  'runtime_history_generated',
  'runtime_history_regression_detected',
  'runtime_lineage_broken',
  'runtime_propagation_risk_detected',
  'temporal_consistency_degraded',
  'runtime_trend_changed',
  'historical_parity_gap_detected',
] as const;
