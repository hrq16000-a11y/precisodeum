/**
 * Fase 1.7.7 — Pure atomic execution simulator (READ-ONLY).
 *
 * Não executa nada. Apenas modela:
 *  - plano de execução legacy (multi-write sequencial)
 *  - plano de execução atomic (single boundary)
 *  - failure points estruturais
 *  - dependências de ordem
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { buildOperationBlueprint } from '@/lib/atomicBlueprint/operationBlueprints';
import type {
  ExecutionPlanStep,
  FailurePoint,
  SimulatedExecutionPlan,
  SimulationResult,
} from './simulationTypes';

function legacyVisibility(idx: number, total: number): ExecutionPlanStep['visibility'] {
  if (total === 1) return 'public';
  if (idx === total - 1) return 'public';
  return 'partial';
}

function buildLegacyPlan(reg: FlowRegistration): SimulatedExecutionPlan {
  const bp = buildOperationBlueprint(reg);
  const steps: ExecutionPlanStep[] = reg.steps.map((s, i) => ({
    step: String(s),
    atomic: false,
    safeRetry: s === 'avatar' || s === 'finalize' || reg.steps.length === 1,
    visibility: legacyVisibility(i, reg.steps.length),
  }));
  return {
    flow: reg.flow,
    steps,
    finalState:
      bp.eventual_consistency_risks.length > 0 ? 'eventually_consistent' : 'consistent',
    rollback: bp.rollback_requirements[0] ?? 'hard_abort',
    consistency: bp.consistency_requirements,
  };
}

function buildAtomicPlan(reg: FlowRegistration): SimulatedExecutionPlan {
  const bp = buildOperationBlueprint(reg);
  const steps: ExecutionPlanStep[] = reg.steps.map((s) => ({
    step: String(s),
    atomic: true,
    safeRetry: true, // dentro da boundary atomica
    visibility: 'private', // tudo invisível até o commit
  }));
  // Último step expõe publicamente após o commit.
  if (steps.length > 0) steps[steps.length - 1].visibility = 'public';
  return {
    flow: reg.flow,
    steps,
    finalState: 'consistent',
    rollback: bp.rollback_requirements[0] ?? 'hard_abort',
    consistency: bp.consistency_requirements,
  };
}

function deriveFailurePoints(reg: FlowRegistration): FailurePoint[] {
  const out: FailurePoint[] = [];
  for (const s of reg.steps) {
    if (s === 'profile' || s === 'profile_type') out.push('profile_write');
    else if (s === 'provider') out.push('provider_write');
    else if (s === 'service') out.push('service_write');
    else if (s === 'avatar') out.push('avatar_write');
    else if (s === 'finalize') out.push('finalize');
  }
  if (reg.requiresProgressSync) out.push('progress_sync');
  const profile = getFlowDriftProfile(reg.flow);
  if (profile?.depends_on_mirror) out.push('mirror_sync');
  out.push('tracker', 'observer');
  return out;
}

export function simulateFlow(flow: FlowId): SimulationResult | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const bp = buildOperationBlueprint(reg);
  const profile = getFlowDriftProfile(flow);
  const legacy = buildLegacyPlan(reg);
  const atomic = buildAtomicPlan(reg);
  return {
    flow,
    legacy,
    atomic,
    expectedFinalState:
      bp.eventual_consistency_risks.length > 0 ? 'eventually_consistent' : 'consistent',
    rollbackVisibility:
      reg.steps.length <= 1 ? 'none' : reg.supportsAtomic ? 'partial' : 'full',
    compensationRequirements: bp.compensation_requirements,
    mirrorPropagation: !!profile?.depends_on_mirror,
    eventualWindows: bp.eventual_consistency_risks,
    dependencyOrder: reg.steps.map((s) => String(s)),
    failurePoints: deriveFailurePoints(reg),
  };
}

export function simulateAll(): Record<FlowId, SimulationResult> {
  const out = {} as Record<FlowId, SimulationResult>;
  for (const r of OPERATION_REGISTRY) {
    const sim = simulateFlow(r.flow);
    if (sim) out[r.flow] = sim;
  }
  return out;
}
