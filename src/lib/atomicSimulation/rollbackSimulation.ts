/**
 * Fase 1.7.7 — Rollback simulation (READ-ONLY, deterministic).
 *
 * Modela cenários estruturais de falha sem invocar nenhum runtime.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import type { AtomicRiskLevel } from '@/lib/atomicBlueprint/atomicBlueprintTypes';
import type {
  RollbackSimulationCase,
  RollbackSimulationReport,
} from './simulationTypes';

function complexityFor(reg: FlowRegistration, severity: AtomicRiskLevel): AtomicRiskLevel {
  if (reg.requiresFinalize) return 'HIGH';
  if (reg.steps.length > 2) return 'HIGH';
  return severity;
}

export function simulateRollback(flow: FlowId): RollbackSimulationReport | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const profile = getFlowDriftProfile(flow);
  const rollback = getRollbackStrategy(flow);
  const baseFeasible = !!rollback;

  const cases: RollbackSimulationCase[] = [];

  // provider fail after profile success
  if (reg.steps.includes('profile') && reg.steps.includes('provider')) {
    cases.push({
      scenario: 'provider_fail_after_profile',
      feasible: baseFeasible,
      compensationPath: ['revert_profile_patch', 'audit_partial_state'],
      visibilityLeak: true,
      orphanRisk: false,
      reconciliationComplexity: complexityFor(reg, 'MEDIUM'),
    });
  }

  // finalize fail after service create
  if (reg.requiresFinalize && reg.steps.includes('service')) {
    cases.push({
      scenario: 'finalize_fail_after_service',
      feasible: false, // finalize roda fora da boundary legacy
      compensationPath: ['retry_finalize', 'mark_orphan_service'],
      visibilityLeak: true,
      orphanRisk: true,
      reconciliationComplexity: 'HIGH',
    });
  }

  // mirror fail
  if (profile?.depends_on_mirror) {
    cases.push({
      scenario: 'mirror_fail',
      feasible: baseFeasible,
      compensationPath: ['enqueue_mirror_reconciliation'],
      visibilityLeak: false,
      orphanRisk: false,
      reconciliationComplexity: complexityFor(reg, 'MEDIUM'),
    });
  }

  // tracker fail — always considered
  cases.push({
    scenario: 'tracker_fail',
    feasible: true,
    compensationPath: ['retry_audit_log'],
    visibilityLeak: false,
    orphanRisk: false,
    reconciliationComplexity: 'LOW',
  });

  // drift emergence
  cases.push({
    scenario: 'drift_emergence',
    feasible: true,
    compensationPath: ['enqueue_drift_reconciliation', 'block_unsafe_writes'],
    visibilityLeak: false,
    orphanRisk: false,
    reconciliationComplexity: complexityFor(reg, 'MEDIUM'),
  });

  // eventual sync lag
  if (profile?.depends_on_eventual_sync) {
    cases.push({
      scenario: 'eventual_sync_lag',
      feasible: true,
      compensationPath: ['await_progress_recompute', 'reconcile_onboarding_flag'],
      visibilityLeak: true,
      orphanRisk: false,
      reconciliationComplexity: 'MEDIUM',
    });
  }

  return { flow, cases };
}

export function simulateAllRollbacks(): Record<FlowId, RollbackSimulationReport> {
  const out = {} as Record<FlowId, RollbackSimulationReport>;
  for (const r of OPERATION_REGISTRY) {
    const rep = simulateRollback(r.flow);
    if (rep) out[r.flow] = rep;
  }
  return out;
}
