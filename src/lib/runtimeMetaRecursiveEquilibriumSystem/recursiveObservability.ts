/**
 * Fase 1.9.12 — Observability (PII-free, READ-ONLY).
 */

import { deepFreeze, reqSignature, stableStringify } from './recursiveEquilibrium';

const PII_KEYS = new Set([
  'email', 'phone', 'whatsapp', 'cpf', 'cnpj', 'city', 'address', 'street',
  'token', 'password', 'payload', 'raw', 'json', 'url', 'ip', 'secret', 'apikey',
]);

export function stripReqSensitive(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripReqSensitive);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(k.toLowerCase())) continue;
    if (v === null || typeof v !== 'object') out[k] = v;
    else if (Array.isArray(v)) out[k] = `array:${v.length}`;
    else out[k] = stripReqSensitive(v);
  }
  return out;
}

export interface ReqObservabilityEvent {
  readonly kind: string;
  readonly target: string;
  readonly signature: string;
  readonly payload: unknown;
}

export function buildReqObservabilityEvent(
  kind: string,
  target: string,
  payload: unknown,
): ReqObservabilityEvent {
  const sanitized = stripReqSensitive(payload);
  return deepFreeze({
    kind,
    target,
    signature: reqSignature(stableStringify(sanitized)),
    payload: sanitized,
  });
}
