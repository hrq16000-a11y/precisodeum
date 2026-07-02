/**
 * Fase 1.7.10 — Observability requirements (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { getPilotCandidate, buildPilotCandidates } from './pilotCandidates';
import type {
  PilotObservabilityLevel,
  PilotObservabilityProfile,
} from './pilotTypes';

function levelFor(blast: string, risk: string): PilotObservabilityLevel {
  if (blast === 'CRITICAL') return 'FULL';
  if (blast === 'HIGH' || risk === 'HIGH') return 'HIGH';
  if (blast === 'MEDIUM' || risk === 'MEDIUM') return 'STANDARD';
  return 'MINIMAL';
}

export function buildObservabilityRequirements(
  flow: FlowId,
): PilotObservabilityProfile | null {
  const c = getPilotCandidate(flow);
  if (!c) return null;
  const level = levelFor(c.blast, c.risk);
  const high = level === 'HIGH' || level === 'FULL';
  const standardOrBetter = high || level === 'STANDARD';
  const profile: PilotObservabilityProfile = {
    flow,
    level,
    parityTracking: true,
    rollbackVisibility: true,
    driftTelemetry: standardOrBetter,
    mirrorTelemetry: standardOrBetter,
    blastMonitoring: high,
    boundaryTracking: standardOrBetter,
    executionTraceability: high,
    coverage: 0,
  };
  profile.coverage = calculateObservabilityCoverage(profile);
  return profile;
}

export function calculateObservabilityCoverage(
  p: PilotObservabilityProfile,
): number {
  const flags = [
    p.parityTracking,
    p.rollbackVisibility,
    p.driftTelemetry,
    p.mirrorTelemetry,
    p.blastMonitoring,
    p.boundaryTracking,
    p.executionTraceability,
  ];
  const on = flags.filter(Boolean).length;
  return Math.round((on / flags.length) * 100);
}

export function detectObservabilityGap(flow: FlowId): string[] {
  const p = buildObservabilityRequirements(flow);
  if (!p) return ['profile_missing'];
  const gaps: string[] = [];
  if (p.level === 'FULL' && p.coverage < 100) gaps.push('coverage_below_full');
  if (p.level === 'HIGH' && p.coverage < 85) gaps.push('coverage_below_high');
  if (p.level === 'STANDARD' && p.coverage < 70) {
    gaps.push('coverage_below_standard');
  }
  return gaps;
}

export function buildAllObservabilityProfiles(): PilotObservabilityProfile[] {
  const out: PilotObservabilityProfile[] = [];
  for (const c of buildPilotCandidates()) {
    const p = buildObservabilityRequirements(c.flow);
    if (p) out.push(p);
  }
  return out;
}
