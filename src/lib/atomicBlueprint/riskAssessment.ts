/**
 * Fase 1.7.6 — Risk assessment determinístico (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { classifyFlowRegistration } from '@/lib/drift/writeClassification';
import type { AtomicRiskLevel } from './atomicBlueprintTypes';

export interface RiskAssessmentResult {
  flow: FlowId;
  level: AtomicRiskLevel;
  score: number;
  factors: string[];
}

function levelFromScore(score: number): AtomicRiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

export function assessFlowRisk(reg: FlowRegistration): RiskAssessmentResult {
  const profile = getFlowDriftProfile(reg.flow);
  const cls = classifyFlowRegistration(reg).classification;
  const factors: string[] = [];
  let score = 0;

  if (reg.steps.length > 1) {
    score += 15;
    factors.push('multi_write');
  }
  if (reg.dependencies.some((d) => d.includes('providers')) &&
      reg.dependencies.some((d) => d.includes('profiles'))) {
    score += 10;
    factors.push('cross_table_writes');
  }
  if (reg.ownership === 'mixed') {
    score += 5;
    factors.push('ownership_coupling');
  }
  if (profile?.depends_on_mirror) {
    score += 10;
    factors.push('mirror_dependence');
  }
  if (reg.requiresFinalize) {
    score += 10;
    factors.push('finalize_dependence');
  }
  if (reg.sideEffects.some((s) => s.includes('redirect') || s.includes('navigation'))) {
    score += 5;
    factors.push('ui_coupling');
  }
  if (reg.sideEffects.length >= 2) {
    score += 10;
    factors.push('multiple_side_effects');
  }
  if (reg.flow === 'persist_first_service') {
    score += 5;
    factors.push('draft_coupling');
  }
  if (reg.boundary === 'adminWriteBoundary') {
    score += 5;
    factors.push('admin_coupling');
  }
  if (!reg.supportsRollback && reg.steps.length > 1) {
    score += 15;
    factors.push('rollback_inexistent');
  }
  if (!reg.supportsAtomic) {
    score += 20;
    factors.push('atomic_boundary_inexistent');
  }
  if (cls === 'LEGACY' || cls === 'UNSAFE') {
    score += 10;
    factors.push('legacy_or_unsafe_classification');
  }

  score = Math.min(100, score);
  return {
    flow: reg.flow,
    level: levelFromScore(score),
    score,
    factors,
  };
}

export function assessAllRisks(): RiskAssessmentResult[] {
  return OPERATION_REGISTRY.map(assessFlowRisk).sort((a, b) => b.score - a.score);
}
