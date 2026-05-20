/**
 * Fase 1.9.1 — Observability emitters (READ-ONLY, fail-soft, PII-free).
 */

import { logAuditAction } from '@/hooks/useAuditLog';

const PII_KEYS = new Set([
  'email',
  'phone',
  'cpf',
  'cnpj',
  'city',
  'address',
  'name',
  'payload',
  'raw',
  'json',
  'url',
  'ip',
]);

function sanitize(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (PII_KEYS.has(k.toLowerCase())) continue;
    if (v === null || typeof v !== 'object') out[k] = v;
    else if (Array.isArray(v)) out[k] = `array:${v.length}`;
    else out[k] = 'object';
  }
  return out;
}

async function emit(
  action: Parameters<typeof logAuditAction>[0]['action'],
  resourceId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await logAuditAction({
      action,
      resource_type: 'runtime_fixed_point',
      resource_id: resourceId,
      details: sanitize(details),
    });
  } catch {
    /* fail-soft */
  }
}

export const emitFixedPointGenerated = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_fixed_point_generated', id, d);
export const emitFixedPointDivergenceDetected = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_fixed_point_diverged', id, d);
export const emitFixedPointOscillationDetected = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_fixed_point_oscillation_detected', id, d);
export const emitFixedPointOverflowDetected = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_fixed_point_overflow_detected', id, d);
export const emitFixedPointNormalizationFailed = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_fixed_point_normalization_failed', id, d);
export const emitFixedPointCertificationInvalid = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_fixed_point_certification_invalid', id, d);
export const emitFixedPointRecursionEscalated = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_fixed_point_recursion_escalated', id, d);
