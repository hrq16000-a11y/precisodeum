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
  try { await logAuditAction({ action, resource_type: 'runtime_category', resource_id: resourceId, details: sanitize(d) }); } catch { /* fail-soft */ }
}

export const emitCategoryGenerated = (id?: string, d?: Record<string, unknown>) => emit('runtime_category_generated', id, d);
export const emitFunctorDegenerated = (id?: string, d?: Record<string, unknown>) => emit('runtime_functor_degenerated', id, d);
export const emitTransformationBroken = (id?: string, d?: Record<string, unknown>) => emit('runtime_transformation_broken', id, d);
export const emitMorphismInfinite = (id?: string, d?: Record<string, unknown>) => emit('runtime_morphism_infinite', id, d);
export const emitCoherenceCollapsed = (id?: string, d?: Record<string, unknown>) => emit('runtime_coherence_collapsed', id, d);
export const emitEquivalenceFractured = (id?: string, d?: Record<string, unknown>) => emit('runtime_equivalence_fractured', id, d);
export const emitCategoryCollapseDetected = (id?: string, d?: Record<string, unknown>) => emit('runtime_category_collapse_detected', id, d);
