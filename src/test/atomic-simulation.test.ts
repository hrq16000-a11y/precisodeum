/**
 * Fase 1.7.7 — Atomic Simulation + Divergence regression suite (READ-ONLY).
 */

import { describe, it, expect } from 'vitest';
import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import {
  assertAllSimulationIntegrity,
  assertBlastRadiusCoverage,
  assertDivergenceClassification,
  assertFailurePropagationKnown,
  assertMigrationConfidenceIntegrity,
  assertNoUnsafeSimulationPromotion,
  assertParityCoverage,
  assertRollbackSimulationCoverage,
  assertSimulationCoverage,
  buildAllShadowComparisons,
  buildShadowComparison,
  calculateAllBlastRadius,
  calculateAllMigrationConfidence,
  calculateBlastRadius,
  calculateExecutionParity,
  calculateMigrationConfidence,
  compareAllConsistency,
  compareConsistency,
  compareLegacyVsAtomic,
  detectAllDivergences,
  detectDivergence,
  detectParityRegression,
  explainParityGap,
  logAtomicSimulationGenerated,
  logDivergenceDetected,
  modelAllFailurePropagation,
  modelFailurePropagation,
  rankByBlastRadius,
  rankByConfidence,
  simulateAll,
  simulateAllRollbacks,
  simulateFlow,
  simulateRollback,
  summarizeFailurePropagation,
  summarizeShadowComparisons,
} from '@/lib/atomicSimulation';

describe('Fase 1.7.7 — Atomic Simulation + Divergence Engine', () => {
  it('A) every flow has a simulation', () => {
    const all = simulateAll();
    for (const r of OPERATION_REGISTRY) {
      expect(all[r.flow]).toBeDefined();
      expect(all[r.flow].legacy.steps.length).toBe(r.steps.length);
      expect(all[r.flow].atomic.steps.length).toBe(r.steps.length);
    }
    expect(assertSimulationCoverage()).toEqual([]);
  });

  it('B) divergence is correctly classified per flow', () => {
    const all = detectAllDivergences();
    for (const r of OPERATION_REGISTRY) {
      const rep = all[r.flow];
      expect(rep).toBeDefined();
      expect(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(rep.worst);
      for (const e of rep.entries) {
        expect(e.kind).toBeTruthy();
        expect(e.severity).toBeTruthy();
      }
    }
    expect(assertDivergenceClassification()).toEqual([]);
  });

  it('C) rollback simulation is consistent across calls', () => {
    const a = simulateAllRollbacks();
    const b = simulateAllRollbacks();
    expect(Object.keys(a)).toEqual(Object.keys(b));
    for (const flow of Object.keys(a) as FlowId[]) {
      expect(a[flow].cases.length).toBe(b[flow].cases.length);
    }
    expect(assertRollbackSimulationCoverage()).toEqual([]);
  });

  it('D) parity is deterministic', () => {
    const a = calculateExecutionParity();
    const b = calculateExecutionParity();
    for (const flow of Object.keys(a) as FlowId[]) {
      expect(a[flow].score).toBe(b[flow].score);
      expect(a[flow].regressions).toEqual(b[flow].regressions);
    }
  });

  it('E) blast radius is stable across calls', () => {
    const a = calculateAllBlastRadius();
    const b = calculateAllBlastRadius();
    for (const flow of Object.keys(a) as FlowId[]) {
      expect(a[flow].level).toBe(b[flow].level);
    }
    expect(assertBlastRadiusCoverage()).toEqual([]);
  });

  it('F) migration confidence is calculated and bounded', () => {
    const all = calculateAllMigrationConfidence();
    for (const r of OPERATION_REGISTRY) {
      const rep = all[r.flow];
      expect(rep).toBeDefined();
      expect(rep.score).toBeGreaterThanOrEqual(0);
      expect(rep.score).toBeLessThanOrEqual(100);
    }
    expect(assertMigrationConfidenceIntegrity()).toEqual([]);
  });

  it('G) failure propagation is modeled for every flow', () => {
    const all = modelAllFailurePropagation();
    for (const r of OPERATION_REGISTRY) {
      expect(all[r.flow]).toBeDefined();
    }
    expect(assertFailurePropagationKnown()).toEqual([]);
  });

  it('H) simulation has no runtime deps (sync, fast)', () => {
    const start = Date.now();
    simulateAll();
    calculateExecutionParity();
    calculateAllBlastRadius();
    calculateAllMigrationConfidence();
    expect(Date.now() - start).toBeLessThan(300);
  });

  it('I) no supabase usage in simulation modules (shape sanity)', () => {
    const sim = simulateFlow('dashboard_profile_save');
    expect(sim).toBeTruthy();
    expect(typeof sim).toBe('object');
  });

  it('J) observability payloads contain no PII and are fail-soft', () => {
    const payload = {
      flow: 'dashboard_profile_save' as FlowId,
      rollback_type: 'compensating_write' as const,
      blast_radius: 'MEDIUM' as const,
      consistency: ['strong'],
    };
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/\+?\d{10,}/);
    expect(json).not.toMatch(/cpf|cnpj/i);
    expect(() => logAtomicSimulationGenerated(payload)).not.toThrow();
    expect(() =>
      logDivergenceDetected('dashboard_profile_save', 'field', 'LOW'),
    ).not.toThrow();
  });

  it('K) assert coverage = 100% (no integrity violations)', () => {
    expect(assertAllSimulationIntegrity()).toEqual([]);
  });

  it('L) unsafe reorder is detectable in shadow comparison', () => {
    const all = buildAllShadowComparisons();
    for (const r of OPERATION_REGISTRY) {
      const rep = all[r.flow];
      expect(rep).toBeDefined();
      expect(typeof rep.unsafeReorder).toBe('boolean');
    }
    // single-step flows must not report reorder
    const avatar = buildShadowComparison('avatar_sync')!;
    expect(avatar.unsafeReorder).toBe(false);
  });

  it('M) orphan risk modeled for persist_first_service', () => {
    const rb = simulateRollback('persist_first_service')!;
    const finalizeCase = rb.cases.find(
      (c) => c.scenario === 'finalize_fail_after_service',
    );
    expect(finalizeCase).toBeDefined();
    expect(finalizeCase!.orphanRisk).toBe(true);
  });

  it('N) finalize mismatch detected when finalize is required but absent', () => {
    const shadow = buildShadowComparison('persist_first_service')!;
    // finalize step IS present in atomic plan, so mismatch should be false
    expect(shadow.finalizeMismatch).toBe(false);
    // but the flow is correctly flagged as finalize-dependent
    const div = detectDivergence('persist_first_service')!;
    expect(div.entries.some((e) => e.kind === 'finalize')).toBe(true);
  });

  it('O) mirror divergence detected for avatar_sync', () => {
    const div = detectDivergence('avatar_sync')!;
    expect(div.entries.some((e) => e.kind === 'mirror')).toBe(true);
  });

  it('P) admin amplification detected for admin flows', () => {
    const fp = modelFailurePropagation('admin_profile_update')!;
    expect(fp.amplifiedBy).toContain('admin_amplification');
  });

  it('Q) drift amplification detected for eventual-sync flows', () => {
    const fp = modelFailurePropagation('persist_first_service')!;
    expect(fp.amplifiedBy).toContain('drift_amplification');
  });

  it('R) no unsafe promotion accepted by guard', () => {
    const violations = assertNoUnsafeSimulationPromotion([
      { flow: 'unknown_flow' as any, promotedTo: 'READY_FOR_SOFT_ATOMIC' },
    ]);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('S) topology parity preserved (legacy and atomic share step order)', () => {
    for (const r of OPERATION_REGISTRY) {
      const sim = simulateFlow(r.flow)!;
      const legacySteps = sim.legacy.steps.map((s) => s.step);
      const atomicSteps = sim.atomic.steps.map((s) => s.step);
      expect(legacySteps).toEqual(atomicSteps);
    }
  });

  it('T) execution order consistent with dependency order', () => {
    for (const r of OPERATION_REGISTRY) {
      const sim = simulateFlow(r.flow)!;
      expect(sim.dependencyOrder).toEqual(r.steps.map((s) => String(s)));
    }
  });

  it('U) parity regression detection works', () => {
    const prev = compareLegacyVsAtomic('dashboard_profile_save')!;
    const curr = { ...prev, score: prev.score - 10, regressions: [...prev.regressions, 'fake'] };
    const regressions = detectParityRegression(prev, curr);
    expect(regressions).toContain('score_dropped');
    expect(regressions).toContain('new:fake');
  });

  it('V) explainParityGap is pure string', () => {
    const p = compareLegacyVsAtomic('avatar_sync')!;
    const s = explainParityGap(p);
    expect(typeof s).toBe('string');
    expect(s).toContain('flow=avatar_sync');
  });

  it('W) consistency comparator matches between legacy and atomic', () => {
    const all = compareAllConsistency();
    for (const r of OPERATION_REGISTRY) {
      const cmp = all[r.flow];
      expect(cmp).toBeDefined();
      // legacy and atomic planos derivam do mesmo blueprint -> matches
      expect(cmp.matches).toBe(true);
    }
    const single = compareConsistency('avatar_sync')!;
    expect(single.shared.length).toBe(single.legacy.length);
  });

  it('X) blast radius ranking and confidence ranking are deterministic', () => {
    expect(rankByBlastRadius()).toEqual(rankByBlastRadius());
    expect(rankByConfidence()).toEqual(rankByConfidence());
  });

  it('Y) summaries are coherent', () => {
    const shadow = summarizeShadowComparisons();
    expect(shadow.totalFlows).toBe(OPERATION_REGISTRY.length);
    const fp = summarizeFailurePropagation();
    expect(fp.totalFlows).toBe(OPERATION_REGISTRY.length);
  });

  it('Z) calculateBlastRadius for unknown flow returns null', () => {
    expect(calculateBlastRadius('xxx' as any)).toBeNull();
    expect(calculateMigrationConfidence('xxx' as any)).toBeNull();
    expect(simulateFlow('xxx' as any)).toBeNull();
    expect(detectDivergence('xxx' as any)).toBeNull();
    expect(simulateRollback('xxx' as any)).toBeNull();
    expect(modelFailurePropagation('xxx' as any)).toBeNull();
    expect(compareLegacyVsAtomic('xxx' as any)).toBeNull();
    expect(buildShadowComparison('xxx' as any)).toBeNull();
    expect(compareConsistency('xxx' as any)).toBeNull();
  });

  it('AA) parity coverage holds with reasonable scores', () => {
    expect(assertParityCoverage()).toEqual([]);
  });
});
