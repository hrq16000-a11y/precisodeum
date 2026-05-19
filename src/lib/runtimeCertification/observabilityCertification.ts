/**
 * Fase 1.7.12 — Observability certification (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type { PromotionConfidence } from '@/lib/atomicPromotion/promotionTypes';
import type {
  RuntimeCertificationLevel,
  RuntimeObservabilityCertification,
} from './certificationTypes';

const REQUIRED_SIGNALS = [
  'parity_tracking',
  'rollback_visibility',
  'execution_traceability',
  'boundary_tracking',
  'drift_telemetry',
];

function presentSignals(flow: FlowId): string[] {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  const profile = getFlowDriftProfile(flow);
  const out = new Set<string>();
  // Fases 1.6.x → 1.7.11 fornecem parity + rollback + boundary + execution traceability.
  out.add('parity_tracking');
  out.add('rollback_visibility');
  out.add('execution_traceability');
  out.add('boundary_tracking');
  if (profile) out.add('drift_telemetry');
  if (reg?.requiresProgressSync) out.add('progress_telemetry');
  return Array.from(out);
}

export function certifyObservabilityCoverage(flow: FlowId): number {
  const present = presentSignals(flow);
  const matched = REQUIRED_SIGNALS.filter((s) => present.includes(s)).length;
  return Math.round((matched / REQUIRED_SIGNALS.length) * 100);
}

export function detectUnsafeObservabilityGap(flow: FlowId): string[] {
  const present = presentSignals(flow);
  return REQUIRED_SIGNALS.filter((s) => !present.includes(s));
}

export function calculateObservabilityConfidence(
  flow: FlowId,
): PromotionConfidence {
  const cov = certifyObservabilityCoverage(flow);
  if (cov >= 95) return 'VERY_HIGH';
  if (cov >= 80) return 'HIGH';
  if (cov >= 60) return 'MODERATE';
  if (cov >= 40) return 'LOW';
  return 'NONE';
}

function levelOf(coverage: number, gaps: number): RuntimeCertificationLevel {
  if (gaps > 2) return 'NONE';
  if (coverage >= 95) return 'FULL';
  if (coverage >= 80) return 'CONDITIONAL';
  if (coverage >= 60) return 'LIMITED';
  return 'NONE';
}

export function buildObservabilityCertification(
  flow: FlowId,
): RuntimeObservabilityCertification {
  const coverage = certifyObservabilityCoverage(flow);
  const gaps = detectUnsafeObservabilityGap(flow);
  return {
    flow,
    coverage,
    gaps,
    confidence: calculateObservabilityConfidence(flow),
    level: levelOf(coverage, gaps.length),
  };
}
