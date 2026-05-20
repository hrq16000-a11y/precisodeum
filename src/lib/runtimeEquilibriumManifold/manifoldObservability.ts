import { logAuditAction } from '@/hooks/useAuditLog';
const PII = new Set(['email','phone','cpf','cnpj','city','address','name','payload','raw','json','url','ip']);
function sanitize(d?: Record<string, unknown>): Record<string, unknown> { if (!d) return {}; const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(d)) { if (PII.has(k.toLowerCase())) continue; if (v === null || typeof v !== 'object') o[k] = v; else if (Array.isArray(v)) o[k] = `array:${v.length}`; else o[k] = 'object'; } return o; }
async function emit(action: Parameters<typeof logAuditAction>[0]['action'], resourceId?: string, d?: Record<string, unknown>): Promise<void> { try { await logAuditAction({ action, resource_type: 'runtime_manifold', resource_id: resourceId, details: sanitize(d) }); } catch { /* fail-soft */ } }
export const emitManifoldGenerated = (id?: string, d?: Record<string, unknown>) => emit('runtime_manifold_generated', id, d);
export const emitContinuityFractured = (id?: string, d?: Record<string, unknown>) => emit('runtime_continuity_fractured', id, d);
export const emitGeodesicInfinite = (id?: string, d?: Record<string, unknown>) => emit('runtime_geodesic_infinite', id, d);
export const emitDeformationIrreversible = (id?: string, d?: Record<string, unknown>) => emit('runtime_deformation_irreversible', id, d);
export const emitMetricInstabilityDetected = (id?: string, d?: Record<string, unknown>) => emit('runtime_metric_instability_detected', id, d);
export const emitContinuumSingularityDetected = (id?: string, d?: Record<string, unknown>) => emit('runtime_continuum_singularity_detected', id, d);
export const emitManifoldCollapseDetected = (id?: string, d?: Record<string, unknown>) => emit('runtime_manifold_collapse_detected', id, d);
