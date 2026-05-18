/**
 * Fase 1.7.2 — Drift Snapshot + Consistency Observatory (READ-ONLY).
 *
 * Builder PURO de snapshots de consistência. Sem Supabase, sem hooks,
 * sem timers, sem window, sem localStorage. Determinístico.
 *
 * Consome apenas registries existentes:
 *  - operationRegistry (1.7.0)
 *  - driftRegistry (1.7.1)
 *  - contactOwnership (1.6.6)
 *  - executeOperation / liveExecutionGate (1.6.9 / 1.7.0)
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import {
  FLOW_DRIFT_PROFILES,
  getFlowDriftProfile,
} from './driftRegistry';
import { DRIFT_CATALOG, type DriftType } from './driftTypes';
import {
  driftSeverityToConsistency,
  maxConsistencySeverity,
  type ConsistencyBoundaryState,
  type ConsistencyExecutionMode,
  type ConsistencyFlowState,
  type ConsistencyMirrorState,
  type ConsistencyRisk,
  type ConsistencyRiskLevel,
  type ConsistencyRiskType,
  type ConsistencySeveritySummary,
  type ConsistencySnapshot,
} from './snapshotTypes';

// ---------------------------------------------------------------------------
// Boundary / mirror inference (read-only).
// ---------------------------------------------------------------------------

const LEGACY_BOUNDARIES = new Set<FlowRegistration['boundary']>(['inline_call_site']);

function inferBoundaryState(reg: FlowRegistration): ConsistencyBoundaryState {
  const hasCanonicalBoundary = !LEGACY_BOUNDARIES.has(reg.boundary);
  const hasTracker =
    reg.boundary === 'multiWriteSync' ||
    reg.boundary === 'avatarSync' ||
    reg.boundary === 'onboardingProgressSync' ||
    reg.boundary === 'adminWriteBoundary';
  return {
    boundary: reg.boundary,
    hasCanonicalBoundary,
    hasTracker,
    hasRollback: reg.supportsRollback,
  };
}

export function detectMirrorDependencies(reg: FlowRegistration): ConsistencyMirrorState {
  const profile = getFlowDriftProfile(reg.flow);
  const driftPotential = profile?.produces_drift_potential ?? [];
  const mirrorDriftPotential = driftPotential.filter((d) =>
    [
      'CONTACT_MISMATCH',
      'AVATAR_MISMATCH',
      'CITY_MISMATCH',
      'INVALID_MIRROR',
      'PROFILE_TYPE_WITHOUT_PROVIDER',
    ].includes(d),
  );
  const hasMirror = (profile?.depends_on_mirror ?? false) || mirrorDriftPotential.length > 0;
  // Mirror requerido = ownership mista OU flow depende explicitamente.
  const mirrorRequired = reg.ownership === 'mixed' || (profile?.depends_on_mirror ?? false);
  return {
    canonicalOwner: reg.ownership,
    hasMirror,
    mirrorRequired,
    mirrorDriftPotential,
  };
}

export function detectBoundaryCoverage(): {
  total: number;
  withBoundary: number;
  withTracker: number;
  legacy: FlowId[];
} {
  const legacy: FlowId[] = [];
  let withBoundary = 0;
  let withTracker = 0;
  for (const r of OPERATION_REGISTRY) {
    const b = inferBoundaryState(r);
    if (b.hasCanonicalBoundary) withBoundary++;
    else legacy.push(r.flow);
    if (b.hasTracker) withTracker++;
  }
  return { total: OPERATION_REGISTRY.length, withBoundary, withTracker, legacy };
}

// ---------------------------------------------------------------------------
// Risk detectors (PURE).
// ---------------------------------------------------------------------------

const RISK_SEVERITY: Record<ConsistencyRiskType, ConsistencyRiskLevel> = {
  missing_boundary: 'high',
  missing_tracker: 'medium',
  dual_write_without_owner: 'high',
  eventual_sync_dependency: 'low',
  mirror_dependency: 'low',
  non_atomic_multi_write: 'medium',
  missing_rollback: 'low',
  legacy_write_path: 'high',
  unsafe_live_dependency: 'critical',
};

function risk(
  flow: FlowId,
  type: ConsistencyRiskType,
  reason: string,
): ConsistencyRisk {
  return { flow, type, severity: RISK_SEVERITY[type], reason };
}

export function detectConsistencyRisks(
  reg: FlowRegistration,
  boundary: ConsistencyBoundaryState,
  mirror: ConsistencyMirrorState,
  executionMode: ConsistencyExecutionMode,
): ConsistencyRisk[] {
  const out: ConsistencyRisk[] = [];
  const profile = getFlowDriftProfile(reg.flow);

  if (!boundary.hasCanonicalBoundary) {
    out.push(risk(reg.flow, 'missing_boundary', 'flow has no canonical boundary'));
    out.push(risk(reg.flow, 'legacy_write_path', 'flow still uses inline call-site'));
  }
  if (!boundary.hasTracker) {
    out.push(risk(reg.flow, 'missing_tracker', 'boundary has no partial-failure tracker'));
  }
  if (mirror.hasMirror && reg.ownership === 'mixed' && !boundary.hasTracker) {
    out.push(
      risk(reg.flow, 'dual_write_without_owner', 'dual-write detected without ownership tracker'),
    );
  }
  if (profile?.depends_on_eventual_sync) {
    out.push(
      risk(reg.flow, 'eventual_sync_dependency', 'flow depends on eventual sync to converge'),
    );
  }
  if (mirror.hasMirror) {
    out.push(risk(reg.flow, 'mirror_dependency', 'flow writes to a mirror table'));
  }
  if (reg.steps.length > 1 && reg.supportsAtomic && executionMode !== 'live') {
    out.push(
      risk(reg.flow, 'non_atomic_multi_write', 'multi-step write not yet atomic (shadow mode)'),
    );
  }
  if (!reg.supportsRollback && reg.steps.length > 1) {
    out.push(risk(reg.flow, 'missing_rollback', 'multi-step write without rollback support'));
  }
  if (executionMode === 'live' && reg.readiness !== 'READY') {
    out.push(
      risk(
        reg.flow,
        'unsafe_live_dependency',
        'live execution requested but flow readiness is not READY',
      ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Snapshot builders (PURE).
// ---------------------------------------------------------------------------

export interface BuildSnapshotOptions {
  executionMode?: ConsistencyExecutionMode;
  /** Injetável para testes determinísticos. */
  now?: () => number;
}

export function buildConsistencySnapshot(
  flow: FlowId,
  opts: BuildSnapshotOptions = {},
): ConsistencyFlowState | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const executionMode = opts.executionMode ?? 'dry-run';
  const boundaryState = inferBoundaryState(reg);
  const mirrorState = detectMirrorDependencies(reg);
  const profile = getFlowDriftProfile(reg.flow);
  const driftPotential: DriftType[] = profile?.produces_drift_potential ?? [];

  const risks = detectConsistencyRisks(reg, boundaryState, mirrorState, executionMode);
  const driftSeverity = maxConsistencySeverity(
    driftPotential.map((d) => driftSeverityToConsistency(DRIFT_CATALOG[d].severity)),
  );
  const riskSeverity = maxConsistencySeverity(risks.map((r) => r.severity));
  const severity = maxConsistencySeverity([driftSeverity, riskSeverity]);

  return {
    flow: reg.flow,
    readiness: reg.readiness,
    executionMode,
    ownership: reg.ownership,
    steps: reg.steps.length,
    isMultiWrite: reg.steps.length > 1,
    requiresFinalize: reg.requiresFinalize,
    requiresAvatarSync: reg.requiresAvatarSync,
    requiresProgressSync: reg.requiresProgressSync,
    requiresDualWrite: mirrorState.hasMirror && reg.ownership === 'mixed',
    dependsOnEventualSync: profile?.depends_on_eventual_sync ?? false,
    supportsAtomic: reg.supportsAtomic,
    supportsRollback: reg.supportsRollback,
    boundaryState,
    mirrorState,
    driftPotential,
    risks,
    severity,
  };
}

export function buildAllConsistencySnapshots(
  opts: BuildSnapshotOptions = {},
): ConsistencySnapshot {
  const executionMode = opts.executionMode ?? 'dry-run';
  const now = (opts.now ?? (() => 0))();
  const flows: ConsistencyFlowState[] = [];
  const risks: ConsistencyRisk[] = [];
  let ready = 0;
  let partial = 0;
  let blocked = 0;
  for (const r of OPERATION_REGISTRY) {
    const state = buildConsistencySnapshot(r.flow, { executionMode });
    if (!state) continue;
    flows.push(state);
    risks.push(...state.risks);
    if (state.readiness === 'READY') ready++;
    else if (state.readiness === 'PARTIAL') partial++;
    else blocked++;
  }
  const severitySummary = summarizeConsistencyRisk(flows);
  const maxSeverity = maxConsistencySeverity(flows.map((f) => f.severity));
  return {
    generatedAt: now,
    executionMode,
    flows,
    risks,
    severitySummary,
    maxSeverity,
    totalFlows: flows.length,
    readyFlows: ready,
    partialFlows: partial,
    blockedFlows: blocked,
  };
}

export function summarizeConsistencyRisk(
  flows: ConsistencyFlowState[],
): ConsistencySeveritySummary {
  const out: ConsistencySeveritySummary = { safe: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const f of flows) out[f.severity]++;
  return out;
}

// ---------------------------------------------------------------------------
// Coverage assertion.
// ---------------------------------------------------------------------------

export interface SnapshotCoverageResult {
  ok: boolean;
  flowsMissingSnapshot: FlowId[];
  driftProfilesWithoutFlow: FlowId[];
  boundariesUnclassified: FlowId[];
}

export function assertSnapshotCoverage(): SnapshotCoverageResult {
  const registryFlows = new Set(OPERATION_REGISTRY.map((r) => r.flow));
  const profileFlows = new Set(FLOW_DRIFT_PROFILES.map((p) => p.flow));
  const flowsMissingSnapshot: FlowId[] = [];
  const boundariesUnclassified: FlowId[] = [];
  for (const r of OPERATION_REGISTRY) {
    const snap = buildConsistencySnapshot(r.flow);
    if (!snap) flowsMissingSnapshot.push(r.flow);
    if (snap && snap.boundaryState.boundary === 'inline_call_site') {
      boundariesUnclassified.push(r.flow);
    }
  }
  const driftProfilesWithoutFlow = [...profileFlows].filter((f) => !registryFlows.has(f));
  return {
    ok:
      flowsMissingSnapshot.length === 0 &&
      driftProfilesWithoutFlow.length === 0 &&
      boundariesUnclassified.length === 0,
    flowsMissingSnapshot,
    driftProfilesWithoutFlow,
    boundariesUnclassified,
  };
}
