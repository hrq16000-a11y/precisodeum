import { logAuditAction } from '@/hooks/useAuditLog';
const PII = new Set(['email','phone','cpf','cnpj','city','address','name','payload','raw','json','url','ip']);
function sanitize(d?: Record<string, unknown>): Record<string, unknown> { if (!d) return {}; const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(d)) { if (PII.has(k.toLowerCase())) continue; if (v === null || typeof v !== 'object') o[k] = v; else if (Array.isArray(v)) o[k] = `array:${v.length}`; else o[k] = 'object'; } return o; }
async function emit(action: Parameters<typeof logAuditAction>[0]['action'], resourceId?: string, d?: Record<string, unknown>): Promise<void> { try { await logAuditAction({ action, resource_type: 'runtime_tensor', resource_id: resourceId, details: sanitize(d) }); } catch { /* fail-soft */ } }
export const emitTensorGenerated = (id?: string, d?: Record<string, unknown>) => emit('runtime_tensor_generated', id, d);
export const emitTensorInstabilityDetected = (id?: string, d?: Record<string, unknown>) => emit('runtime_tensor_instability_detected', id, d);
export const emitCurvatureUnbounded = (id?: string, d?: Record<string, unknown>) => emit('runtime_curvature_unbounded', id, d);
export const emitDensityCritical = (id?: string, d?: Record<string, unknown>) => emit('runtime_density_critical', id, d);
export const emitTopologyDeformed = (id?: string, d?: Record<string, unknown>) => emit('runtime_topology_deformed', id, d);
export const emitSingularityDetected = (id?: string, d?: Record<string, unknown>) => emit('runtime_singularity_detected', id, d);
export const emitTensorCollapseDetected = (id?: string, d?: Record<string, unknown>) => emit('runtime_tensor_collapse_detected', id, d);
