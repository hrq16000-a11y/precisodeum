/**
 * Fase 1.9.3 — Equilibrium Certification (READ-ONLY, pure).
 */
import type {
  EquilibriumCertification,
  EquilibriumClass,
  EquilibriumNode,
  EquilibriumRisk,
  RuntimeEntropyEnvelope,
  RuntimePropagationEnergy,
  RuntimeStabilityField,
  RuntimeTopologyTension,
} from './equilibriumTypes';

export function certifyEquilibrium(args: {
  classification: EquilibriumClass;
  field: RuntimeStabilityField;
  entropy: RuntimeEntropyEnvelope;
  propagation: RuntimePropagationEnergy;
  topology: RuntimeTopologyTension;
  nodes: readonly EquilibriumNode[];
}): EquilibriumCertification {
  const reasons: string[] = [];
  const unsafe = detectUnsafeEquilibrium(args.nodes);
  if (unsafe.length > 0) reasons.push(...unsafe);
  if (args.field.collapsed) reasons.push('field_collapsed');
  if (args.entropy.level === 'CRITICAL') reasons.push('entropy_critical');
  if (args.propagation.unbounded) reasons.push('propagation_unbounded');
  if (args.topology.collapsing) reasons.push('topology_collapsing');
  const confidence = calculateEquilibriumConfidence(args);
  let rank: EquilibriumCertification['rank'] = 'FULL';
  if (unsafe.length > 0 || args.classification === 'COLLAPSED') rank = 'BLOCKED';
  else if (args.classification === 'FRACTURED') rank = 'CONDITIONAL';
  else if (reasons.length > 0 || args.classification === 'TRANSIENT') rank = 'PARTIAL';
  const safe = rank === 'FULL' || rank === 'PARTIAL';
  return Object.freeze({ rank, confidence, safe, reasons: Object.freeze(reasons) });
}

export function calculateEquilibriumConfidence(args: {
  field: RuntimeStabilityField;
  entropy: RuntimeEntropyEnvelope;
  propagation: RuntimePropagationEnergy;
  topology: RuntimeTopologyTension;
}): number {
  return Math.max(0, Math.min(1, (args.field.globalStability + (1 - args.entropy.score) + args.propagation.containment + args.topology.balance) / 4));
}

export function detectUnsafeEquilibrium(nodes: readonly EquilibriumNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.liveExecutionEnabled !== false) out.push(`live:${n.id}`);
    if (n.retryEnabled !== false) out.push(`retry:${n.id}`);
    if (n.backgroundEnabled !== false) out.push(`background:${n.id}`);
    if (n.realUsersAllowed !== false) out.push(`real_users:${n.id}`);
    if (n.stage !== 'STAGE_0_READ_ONLY') out.push(`stage:${n.id}`);
  }
  return out;
}

export function assertEquilibriumSafety(cert: EquilibriumCertification): readonly EquilibriumRisk[] {
  if (cert.safe) return Object.freeze([]);
  return Object.freeze([{
    code: 'EQUILIBRIUM_CERTIFICATION_INVALID',
    severity: cert.rank === 'BLOCKED' ? 'critical' : 'error',
    description: cert.reasons.join(',') || 'unsafe',
  }] as const);
}
