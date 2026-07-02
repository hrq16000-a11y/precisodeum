/**
 * Fase 1.7.6 — Operation blueprints (READ-ONLY).
 *
 * Para cada flow do OPERATION_REGISTRY, monta o blueprint declarativo
 * completo combinando: registry, drift profile, classification,
 * topology, rollback, risk e RPC shape proposta.
 *
 * NENHUMA RPC É CRIADA. Apenas modelagem.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type {
  AtomicFeasibility,
  AtomicRiskLevel,
  OperationBlueprint,
  RecommendedRpcShape,
} from './atomicBlueprintTypes';
import { deriveTopology } from './executionTopology';
import { deriveDependencyRequirements } from './dependencyRequirements';
import { deriveConsistencyRequirements } from './consistencyRequirements';
import { getRollbackStrategy } from './rollbackStrategies';
import { assessFlowRisk } from './riskAssessment';

const RPC_NAME_MAP: Record<FlowId, string> = {
  dashboard_profile_save: 'save_dashboard_profile_atomic',
  persist_first_service: 'persist_first_service_atomic',
  bet_finish_client: 'complete_bet_onboarding_atomic',
  bet_finish_pro: 'complete_bet_onboarding_atomic',
  profile_type_switch: 'switch_profile_type_atomic',
  avatar_sync: 'sync_avatar_atomic',
  onboarding_progress_sync: 'sync_onboarding_progress_atomic',
  admin_profile_update: 'admin_update_user_atomic',
  admin_provider_update: 'admin_update_provider_atomic',
};

function deriveFeasibility(reg: FlowRegistration): AtomicFeasibility {
  if (!reg.supportsAtomic) return 'INFEASIBLE';
  if (reg.readiness === 'READY') return 'FEASIBLE';
  if (reg.readiness === 'PARTIAL') return 'CONDITIONAL';
  return 'INFEASIBLE';
}

function deriveBlastRadius(reg: FlowRegistration): AtomicRiskLevel {
  const sides = reg.sideEffects.length;
  const tables = reg.dependencies.length;
  if (sides >= 2 && tables >= 2) return 'HIGH';
  if (sides >= 1 && tables >= 2) return 'MEDIUM';
  if (tables >= 2) return 'MEDIUM';
  return 'LOW';
}

function buildRpcShape(reg: FlowRegistration): RecommendedRpcShape {
  const rollback = getRollbackStrategy(reg.flow);
  const tables = new Set<string>();
  for (const dep of reg.dependencies) {
    const tbl = dep.split('.')[0];
    if (tbl) tables.add(tbl);
  }
  return {
    name: RPC_NAME_MAP[reg.flow],
    tables: Array.from(tables),
    ordered_writes: reg.steps.map((s) => `${s}_write`),
    validations: [
      'ownership_check',
      'input_shape_check',
      reg.requiresFinalize ? 'finalize_preconditions' : 'noop_validation',
    ],
    ownership_enforcement: `ownership=${reg.ownership}`,
    rollback_semantics: rollback?.strategy ?? 'hard_abort',
    observability_hooks: [
      'operation_executed',
      'operation_execution_failed',
      'drift_detected',
    ],
  };
}

export function buildOperationBlueprint(reg: FlowRegistration): OperationBlueprint {
  const profile = getFlowDriftProfile(reg.flow);
  const rollback = getRollbackStrategy(reg.flow);
  const risk = assessFlowRisk(reg);

  return {
    flow: reg.flow,
    current_write_order: reg.steps.map((s) => String(s)),
    required_atomic_boundaries: [reg.boundary],
    rollback_requirements: rollback ? [rollback.strategy] : ['hard_abort'],
    compensation_requirements:
      rollback?.strategy === 'compensating_write'
        ? reg.steps.map((s) => `compensate_${s}`)
        : [],
    eventual_consistency_risks: profile?.depends_on_eventual_sync
      ? ['finalize_lag', 'progress_lag']
      : [],
    ownership_dependencies: [`ownership=${reg.ownership}`],
    mirror_dependencies: profile?.depends_on_mirror
      ? ['profiles<->providers mirror']
      : [],
    finalize_dependencies: reg.requiresFinalize ? ['finalizeOnboarding'] : [],
    progress_dependencies: reg.requiresProgressSync
      ? ['onboarding_progress.columns']
      : [],
    external_side_effects: [...reg.sideEffects],
    idempotency_requirements:
      reg.steps.length > 1
        ? ['idempotency_key_per_step']
        : ['natural_idempotency'],
    transactional_feasibility: deriveFeasibility(reg),
    recommended_rpc: buildRpcShape(reg),
    migration_complexity: risk.level,
    blast_radius: deriveBlastRadius(reg),
    observability_dependencies: [
      'audit_log',
      'drift_detection',
      'consistency_snapshot',
      'runtime_telemetry',
    ],
    consistency_requirements: deriveConsistencyRequirements(reg),
    topology: deriveTopology(reg),
    dependency_requirements: deriveDependencyRequirements(reg),
  };
}

export function getAllBlueprints(): Record<FlowId, OperationBlueprint> {
  const out = {} as Record<FlowId, OperationBlueprint>;
  for (const r of OPERATION_REGISTRY) out[r.flow] = buildOperationBlueprint(r);
  return out;
}

export function getBlueprint(flow: FlowId): OperationBlueprint | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  return buildOperationBlueprint(reg);
}
