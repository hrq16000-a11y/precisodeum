import type { ManifoldCertification, ManifoldNode, ManifoldRisk, ManifoldStabilityClass, RuntimeContinuityEnvelope, RuntimeContinuumSingularity, RuntimeDeformationContinuum, RuntimePropagationGeodesic } from './manifoldTypes';
export function calculateManifoldConfidence(nodes: readonly ManifoldNode[]): number { if (nodes.length === 0) return 1; const safe = nodes.filter((n) => !n.liveExecutionEnabled && !n.retryEnabled && !n.backgroundEnabled && !n.realUsersAllowed && n.stage === 'STAGE_0_READ_ONLY').length; return safe / nodes.length; }
export function detectUnsafeManifoldState(nodes: readonly ManifoldNode[]): readonly string[] { const r: string[] = []; for (const n of nodes) { if (n.liveExecutionEnabled) r.push(`${n.id}:live`); if (n.retryEnabled) r.push(`${n.id}:retry`); if (n.backgroundEnabled) r.push(`${n.id}:bg`); if (n.realUsersAllowed) r.push(`${n.id}:users`); if (n.stage !== 'STAGE_0_READ_ONLY') r.push(`${n.id}:stage`); } return Object.freeze(r); }
export interface ManifoldCertInput { readonly nodes: readonly ManifoldNode[]; readonly classification: ManifoldStabilityClass; readonly continuity: RuntimeContinuityEnvelope; readonly geodesic: RuntimePropagationGeodesic; readonly deformation: RuntimeDeformationContinuum; readonly singularity: RuntimeContinuumSingularity; }
export function certifyManifoldStability(i: ManifoldCertInput): ManifoldCertification {
  const confidence = calculateManifoldConfidence(i.nodes);
  const unsafe = detectUnsafeManifoldState(i.nodes);
  const reasons: string[] = [...unsafe];
  if (i.geodesic.infinite) reasons.push('geodesic_infinite');
  if (i.continuity.class === 'COLLAPSED' || i.continuity.class === 'FRACTURED') reasons.push('continuity_broken');
  if (i.deformation.irreversible) reasons.push('deformation_irreversible');
  if (i.singularity.terminal) reasons.push('singularity_terminal');
  const safe = reasons.length === 0;
  const rank: ManifoldCertification['rank'] = safe ? 'OK' : (unsafe.length > 0 || i.singularity.terminal) ? 'BLOCKED' : 'WARN';
  return Object.freeze({ safe, confidence, rank, reasons: Object.freeze(reasons) });
}
export function assertManifoldSafety(cert: ManifoldCertification): readonly ManifoldRisk[] { if (cert.safe) return Object.freeze([]); return Object.freeze(cert.reasons.map((r) => ({ code: `MANIFOLD_UNSAFE_${r.toUpperCase()}`, severity: cert.rank === 'BLOCKED' ? 'critical' as const : 'error' as const, description: r }))); }
