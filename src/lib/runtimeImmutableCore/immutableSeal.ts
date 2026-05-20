/**
 * Fase 1.8.8 — Immutable seal (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import type {
  ImmutableBoundary,
  ImmutableClassification,
  ImmutableLayer,
  ImmutableSeal,
  ImmutableSeverity,
  ImmutableViolation,
} from './immutableTypes';

const SEV_ORDER: ImmutableSeverity[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export interface ImmutableSignal {
  readonly flow: FlowId;
  readonly layer: ImmutableLayer;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly currentStage?: string;
  readonly implicitMutation?: boolean;
  readonly boundaryOverride?: boolean;
  readonly recursiveUnlock?: boolean;
}

export function classifyImmutableIntegrity(s: ImmutableSignal): ImmutableClassification {
  if (s.liveExecutionEnabled || s.realUsersAllowed) return 'COMPROMISED';
  if (s.retryEnabled || s.backgroundEnabled) return 'COMPROMISED';
  if (s.recursiveUnlock) return 'COMPROMISED';
  if (s.currentStage && s.currentStage !== 'STAGE_0_READ_ONLY') return 'RESTRICTED';
  if (s.boundaryOverride || s.implicitMutation) return 'GUARDED';
  return 'IMMUTABLE';
}

export function buildBoundary(s: ImmutableSignal): ImmutableBoundary {
  const classification = classifyImmutableIntegrity(s);
  return {
    flow: s.flow,
    layer: s.layer,
    sealed: classification === 'IMMUTABLE' || classification === 'SEALED',
    classification,
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    currentStage: 'STAGE_0_READ_ONLY',
  };
}

export function detectSealCompromise(s: ImmutableSignal): ImmutableViolation | null {
  if (!s.liveExecutionEnabled && !s.realUsersAllowed && !s.retryEnabled && !s.backgroundEnabled) return null;
  return {
    flow: s.flow, layer: s.layer, type: 'runtime_mutation',
    severity: 'CRITICAL', detail: 'seal_compromise_detected',
  };
}

export function detectBoundaryOverride(s: ImmutableSignal): ImmutableViolation | null {
  if (!s.boundaryOverride) return null;
  return {
    flow: s.flow, layer: s.layer, type: 'boundary_override',
    severity: 'HIGH', detail: 'boundary_override_detected',
  };
}

export function detectRuntimeUnlock(s: ImmutableSignal): ImmutableViolation | null {
  if (!s.liveExecutionEnabled && !s.retryEnabled && !s.backgroundEnabled) return null;
  return {
    flow: s.flow, layer: s.layer, type: 'implicit_runtime_enablement',
    severity: 'HIGH', detail: 'runtime_unlock_detected',
  };
}

export function detectImplicitRuntimeMutation(s: ImmutableSignal): ImmutableViolation | null {
  if (!s.implicitMutation) return null;
  return {
    flow: s.flow, layer: s.layer, type: 'runtime_mutation',
    severity: 'HIGH', detail: 'implicit_runtime_mutation',
  };
}

export function collectSealViolations(s: ImmutableSignal): readonly ImmutableViolation[] {
  const out: ImmutableViolation[] = [];
  const a = detectSealCompromise(s); if (a) out.push(a);
  const b = detectBoundaryOverride(s); if (b) out.push(b);
  const c = detectRuntimeUnlock(s); if (c) out.push(c);
  const d = detectImplicitRuntimeMutation(s); if (d) out.push(d);
  if (s.recursiveUnlock) {
    out.push({
      flow: s.flow, layer: s.layer, type: 'recursive_runtime_unlock',
      severity: 'CRITICAL', detail: 'recursive_runtime_unlock',
    });
  }
  return out;
}

function worstSeverity(vs: readonly ImmutableViolation[]): ImmutableSeverity {
  let worst: ImmutableSeverity = 'NONE';
  for (const v of vs) {
    if (SEV_ORDER.indexOf(v.severity) > SEV_ORDER.indexOf(worst)) worst = v.severity;
  }
  return worst;
}

export function buildImmutableSeal(
  flow: FlowId,
  boundaries: readonly ImmutableBoundary[],
  violations: readonly ImmutableViolation[],
  invariants: ImmutableSeal['invariants'] = [],
): ImmutableSeal {
  const sev = worstSeverity(violations);
  let classification: ImmutableClassification = 'IMMUTABLE';
  if (boundaries.some(b => b.classification === 'COMPROMISED') || sev === 'CRITICAL') {
    classification = 'COMPROMISED';
  } else if (boundaries.some(b => b.classification === 'RESTRICTED')) {
    classification = 'RESTRICTED';
  } else if (sev === 'HIGH' || sev === 'MEDIUM' || boundaries.some(b => b.classification === 'GUARDED')) {
    classification = 'GUARDED';
  } else if (boundaries.length > 0 && boundaries.every(b => b.sealed)) {
    classification = 'IMMUTABLE';
  } else if (boundaries.length > 0) {
    classification = 'SEALED';
  }
  const compromised = classification === 'COMPROMISED';
  return { flow, classification, severity: sev, boundaries, violations, invariants, compromised };
}
