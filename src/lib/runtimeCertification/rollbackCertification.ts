/**
 * Fase 1.7.12 — Rollback certification (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import { compareLegacyVsAtomic } from '@/lib/atomicSimulation/executionParity';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import type {
  RuntimeCertificationLevel,
  RuntimeRollbackCertification,
  RuntimeRollbackClass,
} from './certificationTypes';

function rollbackClassOf(flow: FlowId): RuntimeRollbackClass {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  const strat = getRollbackStrategy(flow);
  if (!reg || !strat) return 'incompatible';
  if (reg.steps.length === 1) return 'safe_retry';
  if (reg.requiresFinalize) return 'compensation_required';
  return 'hard_abort';
}

export function certifyRollbackIsolation(flow: FlowId): boolean {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return false;
  return reg.ownership !== 'mixed';
}

export function certifyRollbackConsistency(flow: FlowId): boolean {
  const p = compareLegacyVsAtomic(flow);
  return !!p?.rollbackParity && !!p.consistencyParity;
}

export function detectUnsafeRollbackDependency(flow: FlowId): string[] {
  const out: string[] = [];
  const profile = getFlowDriftProfile(flow);
  if (profile?.depends_on_mirror) out.push('mirror_dependency');
  if (profile?.depends_on_eventual_sync) out.push('eventual_sync_dependency');
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (reg?.requiresProgressSync) out.push('progress_sync_dependency');
  if (reg?.requiresFinalize) out.push('finalize_dependency');
  return out;
}

export function classifyRollbackCertification(
  flow: FlowId,
): RuntimeCertificationLevel {
  const rb = rollbackClassOf(flow);
  if (rb === 'incompatible') return 'NONE';
  const blast = calculateBlastRadius(flow);
  const unsafe = detectUnsafeRollbackDependency(flow);
  const consistent = certifyRollbackConsistency(flow);
  if (blast?.level === 'CRITICAL') return 'LIMITED';
  if (unsafe.length >= 2) return 'LIMITED';
  if (rb === 'compensation_required' && !consistent) return 'LIMITED';
  if (rb === 'safe_retry' && consistent && unsafe.length === 0) return 'FULL';
  if (consistent) return 'CONDITIONAL';
  return 'LIMITED';
}

export function calculateRollbackCertification(
  flow: FlowId,
): RuntimeRollbackCertification {
  const unsafe = detectUnsafeRollbackDependency(flow);
  return {
    flow,
    rollback: rollbackClassOf(flow),
    consistencyOk: certifyRollbackConsistency(flow),
    dependencyOk: unsafe.length === 0,
    unsafeDependencies: unsafe,
    level: classifyRollbackCertification(flow),
  };
}
