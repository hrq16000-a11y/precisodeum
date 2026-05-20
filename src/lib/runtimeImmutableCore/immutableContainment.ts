/**
 * Fase 1.8.8 — Immutable containment (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  ImmutableBoundary,
  ImmutableViolation,
} from './immutableTypes';

export interface ContainmentSignal {
  readonly flow: FlowId;
  readonly boundaries: readonly ImmutableBoundary[];
  readonly crossLayerEscape?: boolean;
  readonly propagationUnlock?: boolean;
  readonly containmentFailure?: boolean;
}

export type ContainmentIntegrity = 'intact' | 'guarded' | 'leaking' | 'broken';

export interface ImmutableContainmentAnalysis {
  readonly flow: FlowId;
  readonly integrity: ContainmentIntegrity;
  readonly violations: readonly ImmutableViolation[];
}

export function detectContainmentFailure(s: ContainmentSignal): ImmutableViolation | null {
  if (!s.containmentFailure) return null;
  const layer = s.boundaries[0]?.layer ?? 'enforcement';
  return {
    flow: s.flow, layer, type: 'drift_escape',
    severity: 'HIGH', detail: 'containment_failure_detected',
  };
}

export function detectCrossLayerEscape(s: ContainmentSignal): ImmutableViolation | null {
  if (!s.crossLayerEscape) return null;
  const layer = s.boundaries[0]?.layer ?? 'enforcement';
  return {
    flow: s.flow, layer, type: 'cross_layer_side_effect',
    severity: 'HIGH', detail: 'cross_layer_escape_detected',
  };
}

export function detectPropagationUnlock(s: ContainmentSignal): ImmutableViolation | null {
  if (!s.propagationUnlock) return null;
  const layer = s.boundaries[0]?.layer ?? 'enforcement';
  return {
    flow: s.flow, layer, type: 'implicit_runtime_enablement',
    severity: 'HIGH', detail: 'propagation_unlock_detected',
  };
}

export function classifyContainmentIntegrity(s: ContainmentSignal): ContainmentIntegrity {
  if (s.containmentFailure) return 'broken';
  if (s.crossLayerEscape) return 'leaking';
  if (s.propagationUnlock) return 'guarded';
  return 'intact';
}

export function analyzeImmutableContainment(s: ContainmentSignal): ImmutableContainmentAnalysis {
  const violations: ImmutableViolation[] = [];
  const a = detectContainmentFailure(s); if (a) violations.push(a);
  const b = detectCrossLayerEscape(s); if (b) violations.push(b);
  const c = detectPropagationUnlock(s); if (c) violations.push(c);
  return { flow: s.flow, integrity: classifyContainmentIntegrity(s), violations };
}
