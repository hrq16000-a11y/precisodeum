/**
 * Fase 1.8.7 — Certification enforcement (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  EnforcementCertification,
  EnforcementCertificationLevel,
  RuntimeEnforcement,
} from './enforcementTypes';

export interface CertificationSignal {
  readonly flow: FlowId;
  readonly enforcement: RuntimeEnforcement;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly currentStage?: string;
  readonly recursiveRuntime?: boolean;
}

export function classifyEnforcementSafety(
  s: CertificationSignal,
): EnforcementCertificationLevel {
  if (s.liveExecutionEnabled || s.realUsersAllowed) return 'BLOCKED';
  if (s.retryEnabled || s.backgroundEnabled) return 'BLOCKED';
  if (s.recursiveRuntime) return 'BLOCKED';
  if (s.currentStage && s.currentStage !== 'STAGE_0_READ_ONLY') return 'CONDITIONAL';
  if (s.enforcement.classification === 'BLOCKED') return 'BLOCKED';
  if (s.enforcement.classification === 'RESTRICTED') return 'CONDITIONAL';
  if (s.enforcement.classification === 'GUARDED') return 'PARTIAL';
  return 'FULL';
}

export function calculateEnforcementConfidence(s: CertificationSignal): number {
  let score = 1.0;
  score -= s.enforcement.violations.length * 0.12;
  if (s.enforcement.lockdown === 'collapsed') score -= 0.5;
  else if (s.enforcement.lockdown === 'unsafe') score -= 0.3;
  else if (s.enforcement.lockdown === 'restricted') score -= 0.15;
  else if (s.enforcement.lockdown === 'guarded') score -= 0.05;
  if (s.liveExecutionEnabled) score = 0;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

export function detectCertificationFailure(s: CertificationSignal): boolean {
  const level = classifyEnforcementSafety(s);
  return level === 'BLOCKED';
}

export function buildEnforcementCertification(
  s: CertificationSignal,
): EnforcementCertification {
  const level = classifyEnforcementSafety(s);
  const confidence = calculateEnforcementConfidence(s);
  const reasons: string[] = [];
  if (s.liveExecutionEnabled) reasons.push('live_execution_enabled');
  if (s.realUsersAllowed) reasons.push('real_users_allowed');
  if (s.retryEnabled) reasons.push('retry_enabled');
  if (s.backgroundEnabled) reasons.push('background_enabled');
  if (s.recursiveRuntime) reasons.push('recursive_runtime');
  if (s.currentStage && s.currentStage !== 'STAGE_0_READ_ONLY') reasons.push('non_read_only_stage');
  if (s.enforcement.violations.length > 0) reasons.push(`violations_${s.enforcement.violations.length}`);
  return {
    flow: s.flow,
    level,
    confidence,
    certified: level === 'FULL' || level === 'PARTIAL',
    reasons,
  };
}

export function rankEnforcementCertification(
  cs: readonly EnforcementCertification[],
): readonly EnforcementCertification[] {
  const order: Record<EnforcementCertificationLevel, number> = {
    FULL: 0, PARTIAL: 1, CONDITIONAL: 2, BLOCKED: 3,
  };
  return [...cs].sort((a, b) => {
    const d = order[a.level] - order[b.level];
    if (d !== 0) return d;
    return b.confidence - a.confidence;
  });
}
