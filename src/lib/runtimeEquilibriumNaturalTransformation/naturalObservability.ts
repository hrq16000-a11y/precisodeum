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
  try { await logAuditAction({ action, resource_type: 'runtime_natural_transformation', resource_id: resourceId, details: sanitize(d) }); } catch { /* fail-soft */ }
}

export const emitNaturalTransformationGenerated = (id?: string, d?: Record<string, unknown>) => emit('runtime_natural_transformation_generated', id, d);
export const emitNaturalityBroken = (id?: string, d?: Record<string, unknown>) => emit('runtime_naturality_broken', id, d);
export const emitCommutativeDiagramFailed = (id?: string, d?: Record<string, unknown>) => emit('runtime_commutative_diagram_failed', id, d);
export const emitNaturalCompositionFailed = (id?: string, d?: Record<string, unknown>) => emit('runtime_natural_composition_failed', id, d);
export const emitNaturalEquivalenceRegressed = (id?: string, d?: Record<string, unknown>) => emit('runtime_natural_equivalence_regressed', id, d);
export const emitNaturalDeterminismDegraded = (id?: string, d?: Record<string, unknown>) => emit('runtime_natural_determinism_degraded', id, d);
export const emitNaturalTopologyUnstable = (id?: string, d?: Record<string, unknown>) => emit('runtime_natural_topology_unstable', id, d);
