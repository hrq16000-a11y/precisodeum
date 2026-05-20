/**
 * Fase 1.8.7 — Boundary enforcement (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  EnforcementBoundary,
  EnforcementClassification,
  EnforcementLayer,
  EnforcementSeverity,
  EnforcementViolation,
} from './enforcementTypes';

export interface BoundarySignal {
  readonly flow: FlowId;
  readonly layer: EnforcementLayer;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly implicitMutation?: boolean;
  readonly crossLayerMutation?: boolean;
  readonly currentStage?: string;
}

export function classifyBoundaryEnforcement(
  s: BoundarySignal,
): EnforcementClassification {
  if (s.liveExecutionEnabled || s.realUsersAllowed) return 'BLOCKED';
  if (s.retryEnabled || s.backgroundEnabled) return 'BLOCKED';
  if (s.currentStage && s.currentStage !== 'STAGE_0_READ_ONLY') return 'RESTRICTED';
  if (s.implicitMutation || s.crossLayerMutation) return 'RESTRICTED';
  return 'LOCKED';
}

export function buildBoundary(s: BoundarySignal): EnforcementBoundary {
  const classification = classifyBoundaryEnforcement(s);
  return {
    flow: s.flow,
    layer: s.layer,
    classification,
    locked: classification === 'LOCKED',
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    currentStage: 'STAGE_0_READ_ONLY',
  };
}

export function detectBoundaryEscape(s: BoundarySignal): EnforcementViolation | null {
  if (!s.liveExecutionEnabled && !s.realUsersAllowed) return null;
  return {
    flow: s.flow, layer: s.layer, type: 'boundary_escape',
    severity: 'CRITICAL', detail: 'boundary_escape_detected',
  };
}

export function detectImplicitMutation(s: BoundarySignal): EnforcementViolation | null {
  if (!s.implicitMutation) return null;
  return {
    flow: s.flow, layer: s.layer, type: 'implicit_mutation',
    severity: 'HIGH', detail: 'implicit_mutation_detected',
  };
}

export function detectCrossLayerMutation(s: BoundarySignal): EnforcementViolation | null {
  if (!s.crossLayerMutation) return null;
  return {
    flow: s.flow, layer: s.layer, type: 'cross_layer_mutation',
    severity: 'HIGH', detail: 'cross_layer_mutation_detected',
  };
}

export function detectUnsafeBoundaryActivation(s: BoundarySignal): EnforcementViolation | null {
  if (s.retryEnabled) {
    return { flow: s.flow, layer: s.layer, type: 'retry_enablement', severity: 'CRITICAL', detail: 'retry_enabled' };
  }
  if (s.backgroundEnabled) {
    return { flow: s.flow, layer: s.layer, type: 'background_enablement', severity: 'CRITICAL', detail: 'background_enabled' };
  }
  if (s.liveExecutionEnabled) {
    return { flow: s.flow, layer: s.layer, type: 'live_execution_attempt', severity: 'CRITICAL', detail: 'live_execution_attempted' };
  }
  return null;
}

export function collectBoundaryViolations(s: BoundarySignal): readonly EnforcementViolation[] {
  const out: EnforcementViolation[] = [];
  const a = detectBoundaryEscape(s); if (a) out.push(a);
  const b = detectImplicitMutation(s); if (b) out.push(b);
  const c = detectCrossLayerMutation(s); if (c) out.push(c);
  const d = detectUnsafeBoundaryActivation(s); if (d) out.push(d);
  return out;
}

export function maxBoundarySeverity(
  vs: readonly EnforcementViolation[],
): EnforcementSeverity {
  const order: EnforcementSeverity[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  let worst: EnforcementSeverity = 'NONE';
  for (const v of vs) {
    if (order.indexOf(v.severity) > order.indexOf(worst)) worst = v.severity;
  }
  return worst;
}
