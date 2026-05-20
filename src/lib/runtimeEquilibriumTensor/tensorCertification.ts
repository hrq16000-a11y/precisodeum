import type { RuntimeCurvatureEnvelope, RuntimeInstabilityDensityEnvelope, RuntimeSingularityEnvelope, RuntimeTopologyGeometry, TensorCertification, TensorNode, TensorRisk, TensorStabilityClass } from './tensorTypes';
export function calculateTensorConfidence(nodes: readonly TensorNode[]): number { if (nodes.length === 0) return 1; const safe = nodes.filter((n) => !n.liveExecutionEnabled && !n.retryEnabled && !n.backgroundEnabled && !n.realUsersAllowed && n.stage === 'STAGE_0_READ_ONLY').length; return safe / nodes.length; }
export function detectUnsafeTensorState(nodes: readonly TensorNode[]): readonly string[] { const r: string[] = []; for (const n of nodes) { if (n.liveExecutionEnabled) r.push(`${n.id}:live`); if (n.retryEnabled) r.push(`${n.id}:retry`); if (n.backgroundEnabled) r.push(`${n.id}:bg`); if (n.realUsersAllowed) r.push(`${n.id}:users`); if (n.stage !== 'STAGE_0_READ_ONLY') r.push(`${n.id}:stage`); } return Object.freeze(r); }
export interface TensorCertificationInput { readonly nodes: readonly TensorNode[]; readonly classification: TensorStabilityClass; readonly curvature: RuntimeCurvatureEnvelope; readonly density: RuntimeInstabilityDensityEnvelope; readonly topology: RuntimeTopologyGeometry; readonly singularity: RuntimeSingularityEnvelope; }
export function certifyTensorStability(i: TensorCertificationInput): TensorCertification {
  const confidence = calculateTensorConfidence(i.nodes);
  const unsafe = detectUnsafeTensorState(i.nodes);
  const reasons: string[] = [...unsafe];
  if (i.curvature.unbounded) reasons.push('curvature_unbounded');
  if (i.density.level === 'CRITICAL') reasons.push('density_critical');
  if (i.topology.collapsing) reasons.push('topology_collapsing');
  if (i.singularity.terminal) reasons.push('singularity_terminal');
  const safe = reasons.length === 0;
  const rank: TensorCertification['rank'] = safe ? 'OK' : (unsafe.length > 0 || i.singularity.terminal) ? 'BLOCKED' : 'WARN';
  return Object.freeze({ safe, confidence, rank, reasons: Object.freeze(reasons) });
}
export function assertTensorSafety(cert: TensorCertification): readonly TensorRisk[] { if (cert.safe) return Object.freeze([]); return Object.freeze(cert.reasons.map((r) => ({ code: `TENSOR_UNSAFE_${r.toUpperCase()}`, severity: cert.rank === 'BLOCKED' ? 'critical' as const : 'error' as const, description: r }))); }
