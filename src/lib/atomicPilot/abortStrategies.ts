/**
 * Fase 1.7.10 — Abort strategies (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { getPilotCandidate, buildPilotCandidates } from './pilotCandidates';
import type { PilotAbortReason, PilotAbortStrategy } from './pilotTypes';

const BASELINE: readonly PilotAbortReason[] = [
  'parity_regression',
  'rollback_failure',
  'drift_explosion',
  'blast_escalation',
  'orphan_emergence',
  'stale_read_spike',
  'mirror_inconsistency',
  'unsafe_promotion',
  'observability_gap',
  'manual_kill_switch',
];

export function buildAbortStrategy(flow: FlowId): PilotAbortStrategy | null {
  const c = getPilotCandidate(flow);
  if (!c) return null;
  const immediate =
    c.blast === 'CRITICAL' || c.rollback === 'incompatible';
  return {
    flow,
    triggers: [...BASELINE],
    immediate,
    graceful: !immediate,
    shadowFallback: true,
    mirrorDisable: c.blast !== 'LOW',
    pilotFreeze: true,
  };
}

export function requiresImmediateAbort(flow: FlowId): boolean {
  return buildAbortStrategy(flow)?.immediate ?? true;
}

export function supportsGracefulAbort(flow: FlowId): boolean {
  return buildAbortStrategy(flow)?.graceful ?? false;
}

export function supportsSafeFallback(flow: FlowId): boolean {
  return buildAbortStrategy(flow)?.shadowFallback ?? false;
}

export function buildAllAbortStrategies(): PilotAbortStrategy[] {
  const out: PilotAbortStrategy[] = [];
  for (const c of buildPilotCandidates()) {
    const s = buildAbortStrategy(c.flow);
    if (s) out.push(s);
  }
  return out;
}
