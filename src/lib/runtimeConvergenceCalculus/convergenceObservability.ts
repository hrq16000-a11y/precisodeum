/**
 * Fase 1.9.2 — Observability emitters (READ-ONLY, fail-soft, PII-free).
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
      resource_type: 'runtime_convergence',
      resource_id: resourceId,
      details: sanitize(details),
    });
  } catch {
    /* fail-soft */
  }
}

export const emitConvergenceGenerated = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_convergence_generated', id, d);
export const emitConvergenceCollapsed = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_convergence_collapsed', id, d);
export const emitFixedPointUnstable = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_fixed_point_unstable', id, d);
export const emitDivergenceDetected = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_divergence_detected', id, d);
export const emitSaturationCritical = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_saturation_critical', id, d);
export const emitTerminalResolutionFailed = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_terminal_resolution_failed', id, d);
export const emitMonotonicityBroken = (id?: string, d?: Record<string, unknown>) =>
  emit('runtime_monotonicity_broken', id, d);
