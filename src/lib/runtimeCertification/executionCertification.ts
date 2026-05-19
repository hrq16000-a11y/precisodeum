/**
 * Fase 1.7.12 — Execution certification (READ-ONLY).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import { compareLegacyVsAtomic } from '@/lib/atomicSimulation/executionParity';
import { simulateFlow } from '@/lib/atomicSimulation/simulateAtomicExecution';
import { buildGovernanceState } from '@/lib/atomicGovernance/governanceMatrix';
import { getRollbackStrategy } from '@/lib/atomicBlueprint/rollbackStrategies';
import type {
  RuntimeCertificationLevel,
  RuntimeExecutionCertification,
  RuntimeExecutionClass,
  RuntimeIsolationClass,
  RuntimeRollbackClass,
} from './certificationTypes';

function isolationOf(flow: FlowId): RuntimeIsolationClass {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return 'unsafe';
  if (reg.ownership === 'mixed') return 'partial';
  if (reg.boundary === 'adminWriteBoundary') return 'boundary_isolated';
  if (reg.steps.length === 1) return 'strict_isolated';
  return 'boundary_isolated';
}

function rollbackOf(flow: FlowId): RuntimeRollbackClass {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  const strat = getRollbackStrategy(flow);
  if (!reg) return 'incompatible';
  if (!strat) return 'incompatible';
  if (reg.steps.length === 1) return 'safe_retry';
  if (reg.requiresFinalize) return 'compensation_required';
  return 'hard_abort';
}

export function certifyExecutionIsolation(flow: FlowId): RuntimeIsolationClass {
  return isolationOf(flow);
}

export function certifyExecutionDeterminism(flow: FlowId): boolean {
  const sim = simulateFlow(flow);
  if (!sim) return false;
  return sim.expectedFinalState === 'consistent' || sim.atomic.finalState === 'consistent';
}

export function certifyExecutionRollback(flow: FlowId): RuntimeRollbackClass {
  return rollbackOf(flow);
}

export function certifyExecutionParity(flow: FlowId): boolean {
  const p = compareLegacyVsAtomic(flow);
  return !!p && p.score >= 70;
}

export function certifyExecutionOrdering(flow: FlowId): boolean {
  const sim = simulateFlow(flow);
  if (!sim) return false;
  return sim.dependencyOrder.length === sim.atomic.steps.length;
}

/**
 * Classifica nível de segurança de execução.
 *
 * Regras blindadas:
 *  - blast CRITICAL → no máximo LIMITED
 *  - flow frozen / quarantined → NONE
 *  - rollback incompatible → NONE
 *  - sem paridade mínima → no máximo LIMITED
 */
export function classifyExecutionSafety(flow: FlowId): RuntimeCertificationLevel {
  const gov = buildGovernanceState(flow);
  if (!gov) return 'NONE';
  if (gov.freeze.level === 'HARD_FREEZE' || gov.freeze.level === 'GLOBAL_FREEZE') return 'NONE';
  const blast = calculateBlastRadius(flow);
  if (!blast) return 'NONE';
  const rollback = rollbackOf(flow);
  if (rollback === 'incompatible') return 'NONE';
  const parity = compareLegacyVsAtomic(flow);
  const score = parity?.score ?? 0;
  if (gov.risk.quarantined) return 'NONE';

  if (blast.level === 'CRITICAL') return 'LIMITED';
  if (gov.risk.conditional) return score >= 85 ? 'CONDITIONAL' : 'LIMITED';
  if (score >= 95 && blast.level === 'LOW' && rollback !== 'compensation_required') {
    return 'FULL';
  }
  if (score >= 85) return 'CONDITIONAL';
  if (score >= 70) return 'LIMITED';
  return 'NONE';
}

function executionClassOf(
  level: RuntimeCertificationLevel,
  blast: ReturnType<typeof calculateBlastRadius>,
): RuntimeExecutionClass {
  if (level === 'NONE') return 'inert';
  if (level === 'LIMITED') return blast?.level === 'CRITICAL' ? 'shadow' : 'limited';
  if (level === 'CONDITIONAL') return 'conditional';
  return 'full';
}

export function buildExecutionCertification(
  flow: FlowId,
): RuntimeExecutionCertification | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const blast = calculateBlastRadius(flow);
  const safety = classifyExecutionSafety(flow);
  // Regra blindada: CONDITIONAL não pode se tornar FULL.
  const safeLevel: RuntimeCertificationLevel =
    safety === 'FULL' && (blast?.level === 'CRITICAL' || blast?.level === 'HIGH')
      ? 'CONDITIONAL'
      : safety;

  return {
    flow,
    isolation: isolationOf(flow),
    determinism: certifyExecutionDeterminism(flow),
    ordering: certifyExecutionOrdering(flow),
    rollback: rollbackOf(flow),
    parityOk: certifyExecutionParity(flow),
    executionClass: executionClassOf(safeLevel, blast),
    safety: safeLevel,
  };
}
