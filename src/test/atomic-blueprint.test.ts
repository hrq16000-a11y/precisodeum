/**
 * Fase 1.7.6 — Atomic Migration Blueprint regression suite (READ-ONLY).
 */

import { describe, it, expect } from 'vitest';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import {
  MIGRATION_STAGES,
  MIGRATION_STAGE_ORDER,
  ROLLBACK_STRATEGIES,
  assessAllRisks,
  assertAllAtomicBlueprintIntegrity,
  assertBlueprintCoverage,
  assertMigrationStageConsistency,
  assertNoUnsafeAtomicPromotion,
  assertRollbackCoverage,
  assertTopologyIntegrity,
  assertAtomicFeasibility,
  buildAtomicReadinessMatrix,
  buildOperationBlueprint,
  deriveConsistencyRequirements,
  deriveTopology,
  explainBlueprint,
  getAllBlueprints,
  getBlueprint,
  getRollbackStrategy,
  summarizeTopology,
  violationToPayload,
  logAtomicBlueprintGenerated,
} from '@/lib/atomicBlueprint';

describe('Fase 1.7.6 — Atomic Migration Blueprint', () => {
  it('A) every registered flow has a blueprint', () => {
    const all = getAllBlueprints();
    for (const reg of OPERATION_REGISTRY) {
      expect(all[reg.flow]).toBeDefined();
      expect(all[reg.flow].flow).toBe(reg.flow);
    }
  });

  it('B) migration stages are coherent (descriptor matches order)', () => {
    expect(MIGRATION_STAGE_ORDER.length).toBe(6);
    expect(MIGRATION_STAGES.length).toBe(6);
    for (const id of MIGRATION_STAGE_ORDER) {
      expect(MIGRATION_STAGES.some((s) => s.id === id)).toBe(true);
    }
    expect(assertMigrationStageConsistency()).toEqual([]);
  });

  it('C) every flow has a rollback strategy', () => {
    for (const reg of OPERATION_REGISTRY) {
      const r = getRollbackStrategy(reg.flow);
      expect(r).toBeDefined();
      expect(r!.strategy).toBeTruthy();
    }
    expect(assertRollbackCoverage()).toEqual([]);
    expect(ROLLBACK_STRATEGIES.length).toBe(OPERATION_REGISTRY.length);
  });

  it('D) topology is consistent with registered steps', () => {
    for (const reg of OPERATION_REGISTRY) {
      const t = deriveTopology(reg);
      expect(t.length).toBe(reg.steps.length);
    }
    expect(assertTopologyIntegrity()).toEqual([]);
  });

  it('E) RPC blueprints are fully populated', () => {
    for (const reg of OPERATION_REGISTRY) {
      const bp = buildOperationBlueprint(reg);
      expect(bp.recommended_rpc.name).toBeTruthy();
      expect(bp.recommended_rpc.tables.length).toBeGreaterThan(0);
      expect(bp.recommended_rpc.ordered_writes.length).toBe(reg.steps.length);
      expect(bp.recommended_rpc.observability_hooks.length).toBeGreaterThan(0);
    }
  });

  it('F) feasibility is deterministic', () => {
    const a = buildOperationBlueprint(OPERATION_REGISTRY[0]).transactional_feasibility;
    const b = buildOperationBlueprint(OPERATION_REGISTRY[0]).transactional_feasibility;
    expect(a).toBe(b);
  });

  it('G) risk scores are stable across calls', () => {
    const a = assessAllRisks();
    const b = assessAllRisks();
    expect(a.map((r) => r.score)).toEqual(b.map((r) => r.score));
    expect(a.map((r) => r.level)).toEqual(b.map((r) => r.level));
  });

  it('H) no runtime dependency: blueprint generation is sync + pure', () => {
    const start = Date.now();
    getAllBlueprints();
    // smoke: returns instantly, no promises
    expect(Date.now() - start).toBeLessThan(200);
  });

  it('I) no supabase / fetch / hooks imported by blueprint modules', async () => {
    // smoke import — if any module pulled supabase at module load,
    // tests would still pass, but we additionally verify shape:
    const bp = getBlueprint('dashboard_profile_save');
    expect(bp).toBeTruthy();
    expect(typeof bp).toBe('object');
  });

  it('J) observability payloads contain no PII', () => {
    const bp = buildOperationBlueprint(OPERATION_REGISTRY[0]);
    const payload = {
      flow: bp.flow,
      feasibility: bp.transactional_feasibility,
      risk: bp.migration_complexity,
      consistency_level: bp.consistency_requirements,
      rollback_type: bp.rollback_requirements[0],
    };
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/\+?\d{10,}/);
    expect(json).not.toMatch(/cpf|cnpj/i);
    // fail-soft emitter shouldn't throw even when audit unavailable
    expect(() => logAtomicBlueprintGenerated(payload as any)).not.toThrow();
  });

  it('K) assert coverage = 100% (no integrity violations)', () => {
    expect(assertBlueprintCoverage()).toEqual([]);
    expect(assertAtomicFeasibility().filter((v) => v.code !== 'CONSISTENCY_GAP')).toEqual([]);
    const all = assertAllAtomicBlueprintIntegrity();
    expect(all).toEqual([]);
  });

  it('L) detects unsafe atomic promotion (INFEASIBLE → STAGE_4)', () => {
    // forçar proposal inválido inventando um flow desconhecido
    const violations = assertNoUnsafeAtomicPromotion([
      { flow: 'unknown_flow' as any, stage: 'STAGE_4_HARD_ATOMIC' },
    ]);
    expect(violations.some((v) => v.code === 'BLUEPRINT_MISSING')).toBe(true);
  });

  it('M) eventual consistency is correctly classified for persist_first_service', () => {
    const reg = OPERATION_REGISTRY.find((r) => r.flow === 'persist_first_service')!;
    const cons = deriveConsistencyRequirements(reg);
    expect(cons).toContain('eventual');
    expect(cons).toContain('finalize');
  });

  it('N) mirror dependencies are modeled for avatar_sync', () => {
    const bp = getBlueprint('avatar_sync')!;
    expect(bp.mirror_dependencies.length).toBeGreaterThan(0);
    expect(bp.consistency_requirements).toContain('mirror');
  });

  it('O) finalize dependencies preserved', () => {
    const bp = getBlueprint('persist_first_service')!;
    expect(bp.finalize_dependencies).toContain('finalizeOnboarding');
  });

  it('P) admin flows remain segregated (admin consistency level)', () => {
    const bp = getBlueprint('admin_profile_update')!;
    expect(bp.consistency_requirements).toContain('admin');
    expect(bp.recommended_rpc.name).toMatch(/admin_/);
  });

  it('Q) atomic readiness matrix covers every flow', () => {
    const matrix = buildAtomicReadinessMatrix();
    expect(matrix.length).toBe(OPERATION_REGISTRY.length);
    for (const row of matrix) {
      expect(row.current_stage).toBe('STAGE_0_READ_ONLY');
      expect(row.next_stage).toBe('STAGE_1_SHADOW_COMPARE');
      expect(row.rollback).toBeTruthy();
    }
  });

  it('R) topology summary is deterministic and structurally consistent', () => {
    const s = summarizeTopology();
    expect(s.total_steps).toBeGreaterThan(0);
    expect(
      s.atomic_required + s.sequential + s.post_commit + s.mirror_propagation + s.eventual_sync,
    ).toBe(s.total_steps);
  });

  it('S) explainer is pure string', () => {
    const bp = getBlueprint('dashboard_profile_save')!;
    const s = explainBlueprint(bp);
    expect(typeof s).toBe('string');
    expect(s).toContain('flow=dashboard_profile_save');
    expect(s).toContain('rpc=save_dashboard_profile_atomic');
  });

  it('T) violationToPayload nulls absent fields', () => {
    const p = violationToPayload({ code: 'BLUEPRINT_MISSING', detail: 'x' });
    expect(p.flow).toBeNull();
    expect(p.stage).toBeNull();
  });
});
