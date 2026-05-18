/**
 * Fase 1.7.6 — Atomic blueprint integrity asserts (READ-ONLY).
 * Pure functions — não lançam, retornam coleções de violations.
 */

import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import type { BlueprintViolation } from './atomicBlueprintTypes';
import { buildOperationBlueprint, getAllBlueprints } from './operationBlueprints';
import { getRollbackStrategy } from './rollbackStrategies';
import { MIGRATION_STAGES, MIGRATION_STAGE_ORDER, getStage } from './migrationStages';
import { deriveTopology } from './executionTopology';
import { deriveConsistencyRequirements } from './consistencyRequirements';

export function assertBlueprintCoverage(): BlueprintViolation[] {
  const all = getAllBlueprints();
  const violations: BlueprintViolation[] = [];
  for (const reg of OPERATION_REGISTRY) {
    if (!all[reg.flow]) {
      violations.push({
        code: 'BLUEPRINT_MISSING',
        flow: reg.flow,
        detail: 'no blueprint generated for registered flow',
      });
    }
  }
  return violations;
}

export function assertMigrationStageConsistency(): BlueprintViolation[] {
  const violations: BlueprintViolation[] = [];
  for (const s of MIGRATION_STAGES) {
    if (!MIGRATION_STAGE_ORDER.includes(s.id)) {
      violations.push({
        code: 'STAGE_INVALID',
        stage: s.id,
        detail: 'stage descriptor not in canonical order list',
      });
    }
    if (!getStage(s.id)) {
      violations.push({
        code: 'STAGE_INVALID',
        stage: s.id,
        detail: 'stage descriptor missing from registry',
      });
    }
  }
  // ordem inversa: cada id em ORDER deve ter descriptor
  for (const id of MIGRATION_STAGE_ORDER) {
    if (!getStage(id)) {
      violations.push({
        code: 'STAGE_INVALID',
        stage: id,
        detail: 'stage in order missing descriptor',
      });
    }
  }
  return violations;
}

export function assertRollbackCoverage(): BlueprintViolation[] {
  const violations: BlueprintViolation[] = [];
  for (const reg of OPERATION_REGISTRY) {
    if (!getRollbackStrategy(reg.flow)) {
      violations.push({
        code: 'ROLLBACK_UNDEFINED',
        flow: reg.flow,
        detail: 'no rollback strategy assigned',
      });
    }
  }
  return violations;
}

export function assertTopologyIntegrity(): BlueprintViolation[] {
  const violations: BlueprintViolation[] = [];
  for (const reg of OPERATION_REGISTRY) {
    const nodes = deriveTopology(reg);
    if (nodes.length !== reg.steps.length) {
      violations.push({
        code: 'TOPOLOGY_UNSAFE',
        flow: reg.flow,
        detail: 'topology node count differs from registered steps',
      });
    }
    // multi-step sem atomic_required nem mirror_propagation nem post_commit
    const allEventual = nodes.length > 1 && nodes.every((n) => n.kind === 'eventual_sync');
    if (allEventual) {
      violations.push({
        code: 'TOPOLOGY_UNSAFE',
        flow: reg.flow,
        detail: 'multi-step flow fully eventual without atomic anchor',
      });
    }
  }
  return violations;
}

export function assertAtomicFeasibility(): BlueprintViolation[] {
  const violations: BlueprintViolation[] = [];
  for (const reg of OPERATION_REGISTRY) {
    const bp = buildOperationBlueprint(reg);
    if (bp.transactional_feasibility === 'INFEASIBLE' && reg.supportsAtomic) {
      violations.push({
        code: 'ATOMICITY_IMPOSSIBLE',
        flow: reg.flow,
        detail: 'registry claims atomic support but blueprint flags INFEASIBLE',
      });
    }
    const cons = deriveConsistencyRequirements(reg);
    if (cons.length === 0) {
      violations.push({
        code: 'CONSISTENCY_GAP',
        flow: reg.flow,
        detail: 'no consistency requirement derived',
      });
    }
    if (reg.requiresFinalize && !cons.includes('finalize')) {
      violations.push({
        code: 'DEPENDENCY_UNRESOLVED',
        flow: reg.flow,
        detail: 'finalize required but missing in consistency set',
      });
    }
  }
  return violations;
}

/**
 * Bloqueia "promoção" de flow INFEASIBLE a estágios atômicos.
 * Recebe uma proposta (flow → stage) e retorna violations.
 */
export function assertNoUnsafeAtomicPromotion(
  proposals: ReadonlyArray<{ flow: import('@/lib/operations/operationRegistry').FlowId; stage: import('./atomicBlueprintTypes').MigrationStageId }>,
): BlueprintViolation[] {
  const violations: BlueprintViolation[] = [];
  const ATOMIC_STAGES = new Set<string>([
    'STAGE_3_SOFT_ATOMIC',
    'STAGE_4_HARD_ATOMIC',
    'STAGE_5_LEGACY_REMOVAL',
  ]);
  for (const p of proposals) {
    const reg = OPERATION_REGISTRY.find((r) => r.flow === p.flow);
    if (!reg) {
      violations.push({
        code: 'BLUEPRINT_MISSING',
        flow: p.flow,
        stage: p.stage,
        detail: 'proposal references unknown flow',
      });
      continue;
    }
    const bp = buildOperationBlueprint(reg);
    if (ATOMIC_STAGES.has(p.stage) && bp.transactional_feasibility === 'INFEASIBLE') {
      violations.push({
        code: 'ATOMICITY_IMPOSSIBLE',
        flow: p.flow,
        stage: p.stage,
        detail: 'cannot promote INFEASIBLE flow to atomic stage',
      });
    }
    if (ATOMIC_STAGES.has(p.stage) && !getRollbackStrategy(p.flow)) {
      violations.push({
        code: 'ROLLBACK_UNDEFINED',
        flow: p.flow,
        stage: p.stage,
        detail: 'atomic stage promotion requires rollback strategy',
      });
    }
  }
  return violations;
}

export function assertAllAtomicBlueprintIntegrity(): BlueprintViolation[] {
  return [
    ...assertBlueprintCoverage(),
    ...assertMigrationStageConsistency(),
    ...assertRollbackCoverage(),
    ...assertTopologyIntegrity(),
    ...assertAtomicFeasibility(),
  ];
}
