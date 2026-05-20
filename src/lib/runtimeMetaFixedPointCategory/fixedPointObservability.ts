/**
 * Fase 1.9.11 — Observability (PII-free, READ-ONLY).
 */

import { deepFreeze, fpcSignature, stableStringify } from './fixedPointCategory';

const PII_KEYS = new Set([
  'email',
  'phone',
  'cpf',
  'cnpj',
  'address',
  'street',
  'city',
  'zipcode',
  'payload',
  'raw',
  'token',
  'secret',
  'apikey',
  'url',
  'href',
  'json',
  'document',
  'name',
  'ip',
]);

export function stripFpcSensitive(
  value: unknown,
): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripFpcSensitive);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(k.toLowerCase())) continue;
    if (v === null || typeof v !== 'object') out[k] = v;
    else if (Array.isArray(v)) out[k] = `array:${v.length}`;
    else out[k] = stripFpcSensitive(v);
  }
  return out;
}

export interface FpcObservabilityEvent {
  readonly kind: string;
  readonly target: string;
  readonly signature: string;
  readonly payload: unknown;
}

export function buildFpcObservabilityEvent(
  kind: string,
  target: string,
  payload: unknown,
): FpcObservabilityEvent {
  const sanitized = stripFpcSensitive(payload);
  return deepFreeze({
    kind,
    target,
    signature: fpcSignature(stableStringify(sanitized)),
    payload: sanitized,
  });
}
