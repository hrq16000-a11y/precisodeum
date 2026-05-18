/**
 * Fase 1.7.7 — Failure propagation modeling (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type {
  FailurePropagationKind,
  FailurePropagationReport,
} from './simulationTypes';

export function modelFailurePropagation(flow: FlowId): FailurePropagationReport | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const profile = getFlowDriftProfile(flow);

  const cascades: FailurePropagationKind[] = [];
  const amplifiedBy: FailurePropagationKind[] = [];

  if (reg.steps.length > 1) cascades.push('cascading');
  if (profile?.depends_on_mirror) amplifiedBy.push('mirror_amplification');
  if (reg.boundary === 'adminWriteBoundary') amplifiedBy.push('admin_amplification');
  if (reg.requiresProgressSync || reg.requiresFinalize) {
    amplifiedBy.push('onboarding_amplification');
  }
  if (profile?.depends_on_eventual_sync) amplifiedBy.push('drift_amplification');

  const orphanRisk = reg.requiresFinalize && reg.steps.includes('service');
  if (orphanRisk) cascades.push('orphan_propagation');

  const staleReadRisk =
    !!profile?.depends_on_eventual_sync || !!profile?.depends_on_mirror;
  if (staleReadRisk) cascades.push('stale_read_propagation');

  return {
    flow,
    cascades,
    amplifiedBy,
    orphanRisk,
    staleReadRisk,
  };
}

export function modelAllFailurePropagation(): Record<FlowId, FailurePropagationReport> {
  const out = {} as Record<FlowId, FailurePropagationReport>;
  for (const r of OPERATION_REGISTRY) {
    const rep = modelFailurePropagation(r.flow);
    if (rep) out[r.flow] = rep;
  }
  return out;
}

export function summarizeFailurePropagation(): {
  totalFlows: number;
  cascading: number;
  mirrorAmplified: number;
  adminAmplified: number;
  onboardingAmplified: number;
  driftAmplified: number;
  orphanRisk: number;
  staleReadRisk: number;
} {
  const all = modelAllFailurePropagation();
  const sum = {
    totalFlows: 0,
    cascading: 0,
    mirrorAmplified: 0,
    adminAmplified: 0,
    onboardingAmplified: 0,
    driftAmplified: 0,
    orphanRisk: 0,
    staleReadRisk: 0,
  };
  for (const r of Object.values(all)) {
    sum.totalFlows += 1;
    if (r.cascades.includes('cascading')) sum.cascading += 1;
    if (r.amplifiedBy.includes('mirror_amplification')) sum.mirrorAmplified += 1;
    if (r.amplifiedBy.includes('admin_amplification')) sum.adminAmplified += 1;
    if (r.amplifiedBy.includes('onboarding_amplification')) sum.onboardingAmplified += 1;
    if (r.amplifiedBy.includes('drift_amplification')) sum.driftAmplified += 1;
    if (r.orphanRisk) sum.orphanRisk += 1;
    if (r.staleReadRisk) sum.staleReadRisk += 1;
  }
  return sum;
}
