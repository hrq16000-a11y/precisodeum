/**
 * Fase 1.9.3 — Observability (READ-ONLY, fail-soft, PII-free).
 */
import { logAuditAction } from '@/hooks/useAuditLog';

const PII = new Set(['email', 'phone', 'cpf', 'cnpj', 'city', 'address', 'name', 'payload', 'raw', 'json', 'url', 'ip']);

function sanitize(d?: Record<string, unknown>): Record<string, unknown> {
  if (!d) return {};
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (PII.has(k.toLowerCase())) continue;
    if (v === null || typeof v !== 'object') o[k] = v;
    else if (Array.isArray(v)) o[k] = `array:${v.length}`;
    else o[k] = 'object';
  }
  return o;
}

async function emit(action: Parameters<typeof logAuditAction>[0]['action'], resourceId?: string, d?: Record<string, unknown>): Promise<void> {
  try {
    await logAuditAction({ action, resource_type: 'runtime_equilibrium', resource_id: resourceId, details: sanitize(d) });
  } catch { /* fail-soft */ }
}

export const emitEquilibriumGenerated = (id?: string, d?: Record<string, unknown>) => emit('runtime_equilibrium_generated', id, d);
export const emitEquilibriumFractured = (id?: string, d?: Record<string, unknown>) => emit('runtime_equilibrium_fractured', id, d);
export const emitEntropyEscalated = (id?: string, d?: Record<string, unknown>) => emit('runtime_entropy_escalated', id, d);
export const emitPropagationUnbounded = (id?: string, d?: Record<string, unknown>) => emit('runtime_propagation_unbounded', id, d);
export const emitTopologyCollapsed = (id?: string, d?: Record<string, unknown>) => emit('runtime_topology_collapsed', id, d);
export const emitMetastableDetected = (id?: string, d?: Record<string, unknown>) => emit('runtime_metastable_detected', id, d);
export const emitEquilibriumDriftDetected = (id?: string, d?: Record<string, unknown>) => emit('runtime_equilibrium_drift_detected', id, d);
