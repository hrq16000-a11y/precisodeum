import { logAuditAction } from '@/hooks/useAuditLog';

const PII = new Set(['email','phone','cpf','cnpj','city','address','name','payload','raw','json','url','ip']);

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
  try { await logAuditAction({ action, resource_type: 'runtime_higher_order_transformation', resource_id: resourceId, details: sanitize(d) }); } catch { /* fail-soft */ }
}

export const emitHigherOrderGenerated = (id?: string, d?: Record<string, unknown>) => emit('runtime_higher_order_generated', id, d);
export const emitHigherOrderCollapsed = (id?: string, d?: Record<string, unknown>) => emit('runtime_higher_order_collapsed', id, d);
export const emitHigherOrderNaturalityBroken = (id?: string, d?: Record<string, unknown>) => emit('runtime_higher_order_naturality_broken', id, d);
export const emitHigherOrderFunctorialityFailed = (id?: string, d?: Record<string, unknown>) => emit('runtime_higher_order_functoriality_failed', id, d);
export const emitHigherOrderEquivalenceRegressed = (id?: string, d?: Record<string, unknown>) => emit('runtime_higher_order_equivalence_regressed', id, d);
export const emitHigherOrderDeterminismDegraded = (id?: string, d?: Record<string, unknown>) => emit('runtime_higher_order_determinism_degraded', id, d);
export const emitHigherOrderTopologyUnstable = (id?: string, d?: Record<string, unknown>) => emit('runtime_higher_order_topology_unstable', id, d);
