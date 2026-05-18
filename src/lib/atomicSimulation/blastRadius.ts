/**
 * Fase 1.7.7 — Blast radius computation (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type { AtomicRiskLevel } from '@/lib/atomicBlueprint/atomicBlueprintTypes';
import type { BlastRadiusLevel, BlastRadiusReport } from './simulationTypes';

function levelOf(score: number): BlastRadiusLevel {
  if (score >= 9) return 'CRITICAL';
  if (score >= 6) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

function rollbackComplexity(reg: FlowRegistration): AtomicRiskLevel {
  if (reg.requiresFinalize) return 'HIGH';
  if (reg.steps.length > 2) return 'HIGH';
  if (reg.steps.length > 1) return 'MEDIUM';
  return 'LOW';
}

export function calculateBlastRadius(flow: FlowId): BlastRadiusReport | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const profile = getFlowDriftProfile(flow);
  const tables = Array.from(
    new Set(reg.dependencies.map((d) => d.split('.')[0]).filter(Boolean)),
  );
  const boundaries = [reg.boundary];
  const ownershipCoupling = reg.ownership === 'mixed';
  const mirrorCoupling = !!profile?.depends_on_mirror;
  const adminExposure = reg.boundary === 'adminWriteBoundary';
  const onboardingExposure = reg.requiresProgressSync || reg.requiresFinalize;
  const driftAmplification = !!profile?.depends_on_eventual_sync;
  const observabilityDependency = reg.sideEffects.length > 0;

  let score = 0;
  score += tables.length; // 1..N
  score += boundaries.length;
  if (ownershipCoupling) score += 1;
  if (mirrorCoupling) score += 2;
  if (adminExposure) score += 1;
  if (onboardingExposure) score += 2;
  if (driftAmplification) score += 1;
  if (observabilityDependency) score += 1;

  return {
    flow,
    tables,
    boundaries,
    ownershipCoupling,
    mirrorCoupling,
    adminExposure,
    onboardingExposure,
    driftAmplification,
    observabilityDependency,
    rollbackComplexity: rollbackComplexity(reg),
    level: levelOf(score),
  };
}

export function calculateAllBlastRadius(): Record<FlowId, BlastRadiusReport> {
  const out = {} as Record<FlowId, BlastRadiusReport>;
  for (const r of OPERATION_REGISTRY) {
    const rep = calculateBlastRadius(r.flow);
    if (rep) out[r.flow] = rep;
  }
  return out;
}

export function rankByBlastRadius(): FlowId[] {
  const all = calculateAllBlastRadius();
  const ORDER: BlastRadiusLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  return Object.values(all)
    .sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level))
    .map((r) => r.flow);
}
