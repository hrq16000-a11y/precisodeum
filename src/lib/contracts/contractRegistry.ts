/**
 * Fase 1.7.5 — Architectural Contract Registry (PURE, READ-ONLY).
 *
 * Registra contratos para 100% dos flows (1.7.0), boundaries (1.6.x),
 * ownership (1.6.6), execution (1.6.9), readiness (1.7.0) e telemetria (1.7.4).
 */

import {
  OPERATION_REGISTRY,
  type BoundaryId,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { classifyFlowRegistration } from '@/lib/drift/writeClassification';
import { isQuarantinedFlow } from '@/lib/drift/quarantineRegistry';
import type {
  AtomicityContract,
  BoundaryContract,
  ContractCoverageReport,
  ExecutionContract,
  FlowContract,
  MirrorContract,
  MutationPolicyId,
  OwnershipContract,
  RollbackContract,
  TelemetryContract,
} from './contractTypes';

const TRACKER_BOUNDARIES = new Set<BoundaryId>([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

function policyFor(reg: FlowRegistration): MutationPolicyId {
  const cls = classifyFlowRegistration(reg).classification;
  if (cls === 'LEGACY') return 'LEGACY_MUTATION';
  if (cls === 'UNSAFE') return 'LEGACY_MUTATION';
  const profile = getFlowDriftProfile(reg.flow);
  if (reg.steps.length > 1 && reg.supportsAtomic && reg.readiness !== 'READY') {
    return 'ATOMIC_CANDIDATE';
  }
  if (profile?.depends_on_mirror) return 'MIRROR_MUTATION';
  if (TRACKER_BOUNDARIES.has(reg.boundary)) return 'CANONICAL_MUTATION';
  return 'GUARDED_MUTATION';
}

// ---------------------------------------------------------------------------
// Flow contracts (1 por flow do registry)
// ---------------------------------------------------------------------------

export function buildFlowContract(reg: FlowRegistration): FlowContract {
  const profile = getFlowDriftProfile(reg.flow);
  const cls = classifyFlowRegistration(reg).classification;
  const guarantees: string[] = [];
  guarantees.push(`ownership=${reg.ownership}`);
  guarantees.push(`boundary=${reg.boundary}`);
  guarantees.push(`readiness=${reg.readiness}`);
  if (reg.supportsAtomic) guarantees.push('atomic_capable');
  if (reg.supportsRollback) guarantees.push('rollback_capable');
  if (profile?.depends_on_eventual_sync) guarantees.push('eventual_consistency');

  const required: string[] = [];
  if (reg.boundary === 'multiWriteSync') required.push('multi_write_sync_audit');
  if (reg.boundary === 'avatarSync') required.push('avatar_sync_failed');
  if (reg.boundary === 'onboardingProgressSync') required.push('onboarding_progress_sync_failed');
  if (reg.boundary === 'adminWriteBoundary') required.push('admin_write_boundary_failed');

  return {
    kind: 'flow',
    flow: reg.flow,
    boundary: reg.boundary,
    ownership: reg.ownership,
    guarantees,
    dependencies: reg.dependencies,
    assumptions: reg.sideEffects,
    requiredObservability: required,
    allowedClassifications:
      cls === 'LEGACY' ? ['LEGACY', 'GUARDED', 'SAFE'] : ['SAFE', 'GUARDED'],
    requiredReadiness: reg.readiness,
    mutationPolicy: policyFor(reg),
    rollbackExpectation:
      reg.steps.length > 1 && reg.supportsAtomic ? 'atomic_required' : reg.supportsRollback ? 'client_side' : 'none',
  };
}

export const FLOW_CONTRACTS: readonly FlowContract[] = OPERATION_REGISTRY.map(buildFlowContract);

// ---------------------------------------------------------------------------
// Boundary contracts
// ---------------------------------------------------------------------------

function buildBoundaryContracts(): BoundaryContract[] {
  const byBoundary = new Map<BoundaryId, FlowId[]>();
  for (const r of OPERATION_REGISTRY) {
    if (!byBoundary.has(r.boundary)) byBoundary.set(r.boundary, []);
    byBoundary.get(r.boundary)!.push(r.flow);
  }
  const out: BoundaryContract[] = [];
  for (const [boundary, flows] of byBoundary.entries()) {
    const hasTracker = TRACKER_BOUNDARIES.has(boundary);
    out.push({
      kind: 'boundary',
      boundary,
      flows,
      hasTracker,
      guarantees: hasTracker
        ? ['partial_failure_tracking', 'pii_free_audit']
        : ['structural_only'],
      dependencies: ['useAuditLog'],
      assumptions: ['boundary_is_called_for_every_flow'],
      requiredObservability: hasTracker ? [`${boundary}_failed`] : [],
      allowedClassifications: hasTracker ? ['SAFE', 'GUARDED'] : ['LEGACY', 'GUARDED'],
      requiredReadiness: 'ANY',
      mutationPolicy: hasTracker ? 'CANONICAL_MUTATION' : 'LEGACY_MUTATION',
      rollbackExpectation: 'client_side',
    });
  }
  return out;
}

export const BOUNDARY_CONTRACTS: readonly BoundaryContract[] = buildBoundaryContracts();

// ---------------------------------------------------------------------------
// Ownership contracts (profile / provider / mixed)
// ---------------------------------------------------------------------------

function buildOwnershipContracts(): OwnershipContract[] {
  const owners: (FlowContract['ownership'])[] = ['profile', 'provider', 'mixed'];
  return owners.map((owner) => {
    const flows = OPERATION_REGISTRY.filter((r) => r.ownership === owner).map((r) => r.flow);
    return {
      kind: 'ownership',
      owner,
      flows,
      guarantees:
        owner === 'mixed'
          ? ['dual_table_consistency', 'mirror_required']
          : [`canonical_owner=${owner}`],
      dependencies: ['contactOwnership_v1_6_6'],
      assumptions: ['ownership_resolved_before_persist'],
      requiredObservability: ['contact_ownership_conflict'],
      allowedClassifications: ['SAFE', 'GUARDED'],
      requiredReadiness: 'ANY',
      mutationPolicy: owner === 'mixed' ? 'MIRROR_MUTATION' : 'CANONICAL_MUTATION',
      rollbackExpectation: 'client_side',
    };
  });
}

export const OWNERSHIP_CONTRACTS: readonly OwnershipContract[] = buildOwnershipContracts();

// ---------------------------------------------------------------------------
// Execution contracts (dry-run by default; live blocked)
// ---------------------------------------------------------------------------

export const EXECUTION_CONTRACTS: readonly ExecutionContract[] = [
  {
    kind: 'execution',
    mode: 'dry-run',
    flows: OPERATION_REGISTRY.map((r) => r.flow),
    guarantees: ['no_persistence_mutation', 'shadow_only'],
    dependencies: ['executeOperation_1_6_9', 'liveExecutionGate_1_7_0'],
    assumptions: ['live_mode_blocked_until_explicit_enable'],
    requiredObservability: ['operation_execution_failed', 'operation_execution_mismatch'],
    allowedClassifications: ['SAFE', 'GUARDED'],
    requiredReadiness: 'ANY',
    mutationPolicy: 'READ_ONLY',
    rollbackExpectation: 'none',
  },
  {
    kind: 'execution',
    mode: 'live',
    flows: [],
    guarantees: ['real_persistence_when_enabled'],
    dependencies: ['executeOperation_1_6_9', 'liveExecutionGate_1_7_0'],
    assumptions: ['only_READY_flows_eligible'],
    requiredObservability: ['live_execution_blocked', 'atomic_readiness_blocked'],
    allowedClassifications: ['SAFE'],
    requiredReadiness: 'READY',
    mutationPolicy: 'ATOMIC_CANDIDATE',
    rollbackExpectation: 'atomic_required',
  },
];

// ---------------------------------------------------------------------------
// Telemetry contracts (1 por flow, exigem 1.7.4)
// ---------------------------------------------------------------------------

function buildTelemetryContracts(): TelemetryContract[] {
  return OPERATION_REGISTRY.map((r) => ({
    kind: 'telemetry',
    flow: r.flow,
    emits: ['flow_execution', 'flow_failure', 'flow_partial_success'],
    guarantees: ['pii_free', 'structural_only'],
    dependencies: ['runtime_telemetry_1_7_4'],
    assumptions: ['events_logged_by_boundary'],
    requiredObservability: ['runtime_telemetry_generated', 'operational_risk_detected'],
    allowedClassifications: ['SAFE', 'GUARDED', 'LEGACY'],
    requiredReadiness: 'ANY',
    mutationPolicy: 'READ_ONLY',
    rollbackExpectation: 'none',
  }));
}

export const TELEMETRY_CONTRACTS: readonly TelemetryContract[] = buildTelemetryContracts();

// ---------------------------------------------------------------------------
// Atomicity contracts
// ---------------------------------------------------------------------------

function buildAtomicityContracts(): AtomicityContract[] {
  return OPERATION_REGISTRY.map((r) => {
    const requiresAtomicMigration =
      r.steps.length > 1 && r.supportsAtomic && r.readiness !== 'READY';
    return {
      kind: 'atomicity',
      flow: r.flow,
      supportsAtomic: r.supportsAtomic,
      isMultiStep: r.steps.length > 1,
      requiresAtomicMigration,
      guarantees: requiresAtomicMigration
        ? ['pending_atomic_rpc_migration']
        : r.steps.length === 1
        ? ['single_step_atomic_by_default']
        : ['ready_for_atomic_migration'],
      dependencies: ['operation_registry_1_7_0', 'execution_layer_1_6_9'],
      assumptions: ['no_partial_persistence_in_legacy_path'],
      requiredObservability: ['atomic_priority_calculated'],
      allowedClassifications: ['SAFE', 'GUARDED'],
      requiredReadiness: r.readiness,
      mutationPolicy: requiresAtomicMigration ? 'ATOMIC_CANDIDATE' : 'CANONICAL_MUTATION',
      rollbackExpectation: r.steps.length > 1 ? 'atomic_required' : 'none',
    };
  });
}

export const ATOMICITY_CONTRACTS: readonly AtomicityContract[] = buildAtomicityContracts();

// ---------------------------------------------------------------------------
// Mirror contracts
// ---------------------------------------------------------------------------

function buildMirrorContracts(): MirrorContract[] {
  return OPERATION_REGISTRY.map((r) => {
    const profile = getFlowDriftProfile(r.flow);
    const hasMirror = !!profile?.depends_on_mirror;
    const mirrorRequired = hasMirror && r.ownership === 'mixed';
    return {
      kind: 'mirror',
      flow: r.flow,
      hasMirror,
      mirrorRequired,
      guarantees: hasMirror ? ['mirror_observable', 'mirror_drift_detectable'] : ['no_mirror'],
      dependencies: ['drift_registry_1_7_1'],
      assumptions: ['mirror_writes_emit_drift_events'],
      requiredObservability: hasMirror ? ['drift_detected', 'mirror_write'] : [],
      allowedClassifications: ['SAFE', 'GUARDED'],
      requiredReadiness: 'ANY',
      mutationPolicy: hasMirror ? 'MIRROR_MUTATION' : 'GUARDED_MUTATION',
      rollbackExpectation: hasMirror ? 'atomic_required' : 'none',
    };
  });
}

export const MIRROR_CONTRACTS: readonly MirrorContract[] = buildMirrorContracts();

// ---------------------------------------------------------------------------
// Rollback contracts
// ---------------------------------------------------------------------------

function buildRollbackContracts(): RollbackContract[] {
  return OPERATION_REGISTRY.map((r) => ({
    kind: 'rollback',
    flow: r.flow,
    supportsRollback: r.supportsRollback,
    guarantees: r.supportsRollback
      ? ['client_side_rollback']
      : r.steps.length > 1
      ? ['rollback_via_atomic_rpc_only']
      : ['single_step_no_rollback_needed'],
    dependencies: ['operation_registry_1_7_0'],
    assumptions: ['no_silent_partial_failure'],
    requiredObservability: ['operation_execution_failed'],
    allowedClassifications: ['SAFE', 'GUARDED'],
    requiredReadiness: 'ANY',
    mutationPolicy: r.steps.length > 1 ? 'ATOMIC_CANDIDATE' : 'GUARDED_MUTATION',
    rollbackExpectation: r.supportsRollback
      ? 'client_side'
      : r.steps.length > 1
      ? 'atomic_required'
      : 'none',
  }));
}

export const ROLLBACK_CONTRACTS: readonly RollbackContract[] = buildRollbackContracts();

// ---------------------------------------------------------------------------
// Lookup helpers + coverage
// ---------------------------------------------------------------------------

export function getFlowContract(flow: FlowId): FlowContract | undefined {
  return FLOW_CONTRACTS.find((c) => c.flow === flow);
}

export function getBoundaryContract(boundary: BoundaryId): BoundaryContract | undefined {
  return BOUNDARY_CONTRACTS.find((c) => c.boundary === boundary);
}

export function getTelemetryContract(flow: FlowId): TelemetryContract | undefined {
  return TELEMETRY_CONTRACTS.find((c) => c.flow === flow);
}

export function getAtomicityContract(flow: FlowId): AtomicityContract | undefined {
  return ATOMICITY_CONTRACTS.find((c) => c.flow === flow);
}

export function getMirrorContract(flow: FlowId): MirrorContract | undefined {
  return MIRROR_CONTRACTS.find((c) => c.flow === flow);
}

export function getRollbackContract(flow: FlowId): RollbackContract | undefined {
  return ROLLBACK_CONTRACTS.find((c) => c.flow === flow);
}

export function assertContractCoverage(): ContractCoverageReport {
  const flowsCovered = new Set(FLOW_CONTRACTS.map((c) => c.flow));
  const boundariesCovered = new Set(BOUNDARY_CONTRACTS.map((c) => c.boundary));
  const flowsMissingContract = OPERATION_REGISTRY.map((r) => r.flow).filter(
    (f) => !flowsCovered.has(f),
  );
  const allBoundaries = new Set(OPERATION_REGISTRY.map((r) => r.boundary));
  const boundariesMissingContract = [...allBoundaries].filter((b) => !boundariesCovered.has(b));
  return {
    ok: flowsMissingContract.length === 0 && boundariesMissingContract.length === 0,
    totalFlows: OPERATION_REGISTRY.length,
    flowsWithContract: flowsCovered.size,
    boundariesWithContract: boundariesCovered.size,
    flowsMissingContract,
    boundariesMissingContract,
  };
}

// Re-export the quarantine helper for symmetry with downstream guarantees.
export { isQuarantinedFlow };
