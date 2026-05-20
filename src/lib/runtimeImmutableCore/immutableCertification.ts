/**
 * Fase 1.8.8 — Immutable certification (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  ImmutableCertification,
  ImmutableCertificationLevel,
  ImmutableSeal,
} from './immutableTypes';

export interface CertificationSignal {
  readonly flow: FlowId;
  readonly seal: ImmutableSeal;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly currentStage?: string;
  readonly recursiveUnlock?: boolean;
  readonly pilotActive?: boolean;
}

export function classifyImmutableSafety(s: CertificationSignal): ImmutableCertificationLevel {
  if (s.liveExecutionEnabled || s.realUsersAllowed) return 'BLOCKED';
  if (s.retryEnabled || s.backgroundEnabled) return 'BLOCKED';
  if (s.pilotActive) return 'BLOCKED';
  if (s.recursiveUnlock) return 'BLOCKED';
  if (s.seal.compromised) return 'BLOCKED';
  if (s.currentStage && s.currentStage !== 'STAGE_0_READ_ONLY') return 'CONDITIONAL';
  if (s.seal.classification === 'RESTRICTED') return 'CONDITIONAL';
  if (s.seal.classification === 'GUARDED') return 'PARTIAL';
  return 'FULL';
}

export function calculateImmutableConfidence(s: CertificationSignal): number {
  let score = 1.0;
  score -= s.seal.violations.length * 0.12;
  if (s.seal.compromised) return 0;
  if (s.seal.classification === 'RESTRICTED') score -= 0.25;
  else if (s.seal.classification === 'GUARDED') score -= 0.1;
  if (s.liveExecutionEnabled || s.realUsersAllowed) return 0;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

export function detectImmutableCertificationFailure(s: CertificationSignal): boolean {
  return classifyImmutableSafety(s) === 'BLOCKED';
}

export function buildImmutableCertification(s: CertificationSignal): ImmutableCertification {
  const level = classifyImmutableSafety(s);
  const confidence = calculateImmutableConfidence(s);
  const reasons: string[] = [];
  if (s.liveExecutionEnabled) reasons.push('live_execution_enabled');
  if (s.realUsersAllowed) reasons.push('real_users_allowed');
  if (s.retryEnabled) reasons.push('retry_enabled');
  if (s.backgroundEnabled) reasons.push('background_enabled');
  if (s.pilotActive) reasons.push('pilot_active');
  if (s.recursiveUnlock) reasons.push('recursive_unlock');
  if (s.seal.compromised) reasons.push('seal_compromised');
  if (s.currentStage && s.currentStage !== 'STAGE_0_READ_ONLY') reasons.push('non_read_only_stage');
  if (s.seal.violations.length > 0) reasons.push(`violations_${s.seal.violations.length}`);
  return {
    flow: s.flow,
    level,
    confidence,
    certified: level === 'FULL' || level === 'PARTIAL',
    reasons,
  };
}

export function rankImmutableCertification(
  cs: readonly ImmutableCertification[],
): readonly ImmutableCertification[] {
  const order: Record<ImmutableCertificationLevel, number> = {
    FULL: 0, PARTIAL: 1, CONDITIONAL: 2, BLOCKED: 3,
  };
  return [...cs].sort((a, b) => {
    const d = order[a.level] - order[b.level];
    if (d !== 0) return d;
    return b.confidence - a.confidence;
  });
}
