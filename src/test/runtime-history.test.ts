/**
 * Fase 1.8.1 — Runtime History tests (READ-ONLY).
 * Cobertura A→Z. Sem persistência, sem live execution.
 */
import { describe, it, expect } from 'vitest';
import {
  createRuntimeTrace,
  appendTraceStep,
  finalizeRuntimeTrace,
} from '@/lib/runtimeRecorder';
import {
  buildRuntimeHistory,
  appendRuntimeHistoryEntry,
  summarizeRuntimeHistory,
  calculateHistoryTrend,
  detectRuntimeInstability,
  detectRuntimeRegression,
  calculateRuntimeConfidence,
  buildRuntimeLineage,
  detectBrokenLineage,
  detectMissingOwnerPropagation,
  detectMirrorOnlyPropagation,
  detectFinalizeLineageGap,
  classifyRuntimeLineage,
  buildPropagationChain,
  detectUnsafePropagation,
  detectCircularPropagation,
  detectHiddenDependencyPropagation,
  classifyPropagationRisk,
  compareTemporalConsistency,
  detectTemporalDrift,
  detectTemporalOrderingRegression,
  detectTemporalParityRegression,
  classifyTemporalConsistency,
  detectTrendDegradation,
  detectStabilityRecovery,
  detectEscalatingFailures,
  calculateRuntimeHealthTrend,
  aggregateRuntimeHistory,
  summarizeHistoryRisk,
  summarizeHistoryParity,
  summarizeHistoryFailures,
  buildRuntimeHistoryHealth,
  compareHistoryToSimulation,
  compareHistoryToCertification,
  compareHistoryToGovernance,
  calculateHistoricalParityGap,
  buildHistoryAuditPayload,
  isHistoryAuditPayloadPiiFree,
  HISTORY_AUDIT_ACTIONS,
  explainRuntimeHistory,
  explainRuntimeTrend,
  explainRuntimeLineage,
  explainPropagationRisk,
  explainTemporalConsistency,
  explainHistoricalParityGap,
  assertRuntimeHistoryIntegrity,
  assertNoUnsafeTemporalRegression,
  assertRuntimeLineageConsistency,
  assertPropagationIntegrity,
  assertTemporalConsistencyIntegrity,
  assertNoHistoricalPromotionLeak,
  assertAllRuntimeHistoryIntegrity,
  adaptRuntimeRecorderToHistory,
  adaptSimulationToHistory,
  adaptCertificationToHistory,
  adaptGovernanceToHistory,
  adaptPromotionToHistory,
} from '@/lib/runtimeHistory';

const okStep = (step: string, opts: Partial<{ mirror: boolean; dependsOn: string[] }> = {}) => ({
  step,
  status: 'ok' as const,
  durationBucket: 'fast' as const,
  dependsOn: opts.dependsOn ?? [],
  boundary: 'multiWriteSync' as const,
  visibility: 'private' as const,
  requiresOwner: false,
  mirror: opts.mirror ?? false,
});

function consistentTrace(flow: 'dashboard_profile_save' = 'dashboard_profile_save') {
  let t = createRuntimeTrace(flow, 'multiWriteSync');
  t = appendTraceStep(t, okStep('profile'));
  t = appendTraceStep(t, okStep('provider'));
  return finalizeRuntimeTrace(t);
}

function orphanTrace() {
  let t = createRuntimeTrace('avatar_sync', 'avatarSync');
  t = appendTraceStep(t, okStep('avatar', { mirror: true }));
  return finalizeRuntimeTrace(t);
}

function failedTrace() {
  let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
  t = appendTraceStep(t, okStep('profile'));
  t = appendTraceStep(t, {
    ...okStep('provider'),
    status: 'failed',
    failure: { code: 'db', class: 'dependency', severity: 'HIGH', cascaded: true },
  });
  return finalizeRuntimeTrace(t);
}

describe('Fase 1.8.1 — Runtime History', () => {
  // A
  it('A) buildRuntimeHistory cria janela determinística', () => {
    const w = buildRuntimeHistory('dashboard_profile_save', [consistentTrace(), consistentTrace()]);
    expect(w.entries.length).toBe(2);
    expect(w.flow).toBe('dashboard_profile_save');
    expect(w.entries[0].sequence).toBe(0);
    expect(w.entries[1].sequence).toBe(1);
  });

  // B
  it('B) appendRuntimeHistoryEntry é imutável', () => {
    const w = buildRuntimeHistory('dashboard_profile_save', [consistentTrace()]);
    const w2 = appendRuntimeHistoryEntry(w, consistentTrace());
    expect(w.entries.length).toBe(1);
    expect(w2.entries.length).toBe(2);
  });

  // C
  it('C) summarizeRuntimeHistory calcula ratios', () => {
    const w = buildRuntimeHistory('dashboard_profile_save', [consistentTrace(), failedTrace()]);
    const s = summarizeRuntimeHistory(w);
    expect(s.consistentRatio).toBeCloseTo(0.5, 1);
    expect(s.samples).toBe(2);
  });

  // D
  it('D) calculateHistoryTrend stable em série uniforme', () => {
    expect(calculateHistoryTrend([0.1, 0.1, 0.1, 0.1])).toBe('stable');
  });

  // E
  it('E) calculateHistoryTrend degrading em piora consistente', () => {
    expect(calculateHistoryTrend([0.1, 0.1, 0.5, 0.6])).toBe('degrading');
  });

  // F
  it('F) detectRuntimeInstability captura oscilações', () => {
    let w = buildRuntimeHistory('dashboard_profile_save', []);
    w = appendRuntimeHistoryEntry(w, consistentTrace());
    w = appendRuntimeHistoryEntry(w, failedTrace());
    w = appendRuntimeHistoryEntry(w, consistentTrace());
    w = appendRuntimeHistoryEntry(w, failedTrace());
    w = appendRuntimeHistoryEntry(w, consistentTrace());
    expect(detectRuntimeInstability(w)).toBe(true);
  });

  // G
  it('G) detectRuntimeRegression vê severidade subindo', () => {
    let w = buildRuntimeHistory('dashboard_profile_save', []);
    for (let i = 0; i < 2; i++) w = appendRuntimeHistoryEntry(w, consistentTrace());
    for (let i = 0; i < 3; i++) w = appendRuntimeHistoryEntry(w, failedTrace());
    expect(detectRuntimeRegression(w)).toBe(true);
  });

  // H
  it('H) calculateRuntimeConfidence cai com orphan', () => {
    const w = buildRuntimeHistory('avatar_sync', [orphanTrace(), orphanTrace()]);
    expect(calculateRuntimeConfidence(w)).toBeLessThan(0.5);
  });

  // I
  it('I) buildRuntimeLineage detecta mirror_only', () => {
    const l = buildRuntimeLineage('avatar_sync', [orphanTrace()]);
    expect(l.class).toBe('mirror_only');
    expect(detectMirrorOnlyPropagation('avatar_sync', [orphanTrace()])).toBe(true);
    expect(detectMissingOwnerPropagation('avatar_sync', [orphanTrace()])).toBe(true);
    expect(detectBrokenLineage('avatar_sync', [orphanTrace()])).toBe(true);
  });

  // J
  it('J) classifyRuntimeLineage retorna finalize_gap', () => {
    const c = classifyRuntimeLineage({
      owners: ['profile'],
      mirrors: [],
      finalizers: [],
      gaps: [],
      requiresFinalize: true,
    });
    expect(c).toBe('finalize_gap');
  });

  // K
  it('K) detectFinalizeLineageGap depende de requiresFinalize do registry', () => {
    // dashboard_profile_save não exige finalize → não gera finalize_gap
    expect(detectFinalizeLineageGap('dashboard_profile_save', [consistentTrace()])).toBe(false);
  });

  // L
  it('L) buildPropagationChain captura nodes/edges', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    t = appendTraceStep(t, okStep('provider', { dependsOn: ['profile'] }));
    t = finalizeRuntimeTrace(t);
    const c = buildPropagationChain('dashboard_profile_save', [t]);
    expect(c.nodes).toContain('profile');
    expect(c.edges.some(([a, b]) => a === 'profile' && b === 'provider')).toBe(true);
    expect(c.cycle.length).toBe(0);
  });

  // M
  it('M) detectCircularPropagation captura ciclo', () => {
    // construir traces sintéticos que declarem ciclo via dependsOn
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, { ...okStep('a', { dependsOn: ['b'] }) });
    t = appendTraceStep(t, { ...okStep('b', { dependsOn: ['a'] }) });
    t = finalizeRuntimeTrace(t);
    expect(detectCircularPropagation('dashboard_profile_save', [t])).toBe(true);
    expect(detectUnsafePropagation('dashboard_profile_save', [t])).toBe(true);
  });

  // N
  it('N) detectHiddenDependencyPropagation captura dep não declarada como step', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile', { dependsOn: ['ghost_step'] }));
    t = finalizeRuntimeTrace(t);
    expect(detectHiddenDependencyPropagation('dashboard_profile_save', [t])).toBe(true);
  });

  // O
  it('O) classifyPropagationRisk segue heurísticas', () => {
    expect(classifyPropagationRisk({ nodeCount: 0, edgeCount: 0, cycleLength: 0, hiddenCount: 0 })).toBe('unknown');
    expect(classifyPropagationRisk({ nodeCount: 2, edgeCount: 0, cycleLength: 0, hiddenCount: 0 })).toBe('isolated');
    expect(classifyPropagationRisk({ nodeCount: 2, edgeCount: 1, cycleLength: 1, hiddenCount: 0 })).toBe('circular');
    expect(classifyPropagationRisk({ nodeCount: 2, edgeCount: 1, cycleLength: 0, hiddenCount: 1 })).toBe('cascading');
  });

  // P
  it('P) temporal degradação detectada', () => {
    const prev = buildRuntimeHistory('dashboard_profile_save', [consistentTrace(), consistentTrace()]);
    const next = buildRuntimeHistory('dashboard_profile_save', [failedTrace(), failedTrace()]);
    const cmp = compareTemporalConsistency(prev, next);
    expect(['degrading', 'severe_regression']).toContain(cmp.class);
    expect(detectTemporalDrift(prev, next)).toBe(true);
    expect(detectTemporalParityRegression(prev, next)).toBe(true);
    expect(classifyTemporalConsistency(prev, next)).toBe(cmp.class);
  });

  // Q
  it('Q) temporal ordering regression isolada', () => {
    // criar trace com ordering violation: progress antes de finalize
    const buildOrderingViolation = () => {
      let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
      t = appendTraceStep(t, okStep('progress'));
      t = appendTraceStep(t, okStep('finalize'));
      return finalizeRuntimeTrace(t);
    };
    const prev = buildRuntimeHistory('dashboard_profile_save', [consistentTrace()]);
    const next = buildRuntimeHistory('dashboard_profile_save', [
      buildOrderingViolation(),
      buildOrderingViolation(),
    ]);
    expect(detectTemporalOrderingRegression(prev, next)).toBe(true);
  });

  // R
  it('R) trend analysis: escalating failures', () => {
    let w = buildRuntimeHistory('dashboard_profile_save', []);
    for (let i = 0; i < 4; i++) w = appendRuntimeHistoryEntry(w, failedTrace());
    expect(detectEscalatingFailures(w)).toBe(true);
    expect(calculateRuntimeHealthTrend(w)).toBe('degrading');
  });

  // S
  it('S) stability recovery', () => {
    let w = buildRuntimeHistory('dashboard_profile_save', []);
    for (let i = 0; i < 3; i++) w = appendRuntimeHistoryEntry(w, failedTrace());
    for (let i = 0; i < 3; i++) w = appendRuntimeHistoryEntry(w, consistentTrace());
    expect(detectStabilityRecovery(w)).toBe(true);
    expect(detectTrendDegradation(w)).toBe(false);
  });

  // T
  it('T) aggregate + health builder', () => {
    const traces = [consistentTrace(), consistentTrace(), failedTrace()];
    const w = aggregateRuntimeHistory('dashboard_profile_save', traces);
    const health = buildRuntimeHistoryHealth('dashboard_profile_save', traces);
    expect(w.entries.length).toBe(3);
    expect(health.flow).toBe('dashboard_profile_save');
    expect(health.lineage).toBeDefined();
    expect(health.propagation).toBeDefined();
    const fails = summarizeHistoryFailures(w);
    expect(fails.samples).toBe(3);
    const parity = summarizeHistoryParity(w, traces);
    expect(parity.samples).toBe(3);
    const risk = summarizeHistoryRisk(w);
    expect(['NONE','LOW','MEDIUM','HIGH','CRITICAL']).toContain(risk);
  });

  // U
  it('U) compareHistoryToSimulation/Certification/Governance read-only', () => {
    const traces = [consistentTrace(), consistentTrace()];
    const w = buildRuntimeHistory('dashboard_profile_save', traces);
    const sim = compareHistoryToSimulation(w, traces);
    const cert = compareHistoryToCertification(w, traces);
    const gov = compareHistoryToGovernance(w);
    expect(sim.flow).toBe('dashboard_profile_save');
    expect(cert.meetsRollbackFloor).toBe(true);
    expect(gov.governanceSafe).toBe(true);
    expect(calculateHistoricalParityGap(w, traces)).toBeGreaterThanOrEqual(0);
  });

  // V
  it('V) observability é PII-free', () => {
    const safe = buildHistoryAuditPayload('runtime_history_generated', 'dashboard_profile_save', {
      samples: 3,
      severity: 'NONE',
    });
    expect(isHistoryAuditPayloadPiiFree(safe)).toBe(true);
    const stripped = buildHistoryAuditPayload('runtime_history_generated', 'dashboard_profile_save', {
      samples: 3,
      email: 'a@b.com',
    } as Record<string, string | number | boolean>);
    expect(stripped.metadata.email).toBeUndefined();
    // payload com URL no value
    const bad = { action: 'runtime_history_generated' as const, flow: 'dashboard_profile_save' as const, metadata: { note: 'http://x.com' } };
    expect(isHistoryAuditPayloadPiiFree(bad)).toBe(false);
    expect(HISTORY_AUDIT_ACTIONS.length).toBe(7);
  });

  // W
  it('W) explainers retornam strings determinísticas', () => {
    const traces = [consistentTrace()];
    const w = buildRuntimeHistory('dashboard_profile_save', traces);
    const h = buildRuntimeHistoryHealth('dashboard_profile_save', traces);
    expect(explainRuntimeHistory(h)).toContain('flow=dashboard_profile_save');
    expect(explainRuntimeTrend('improving')).toContain('melhoria');
    expect(explainRuntimeLineage(h.lineage)).toContain('lineage=');
    expect(explainPropagationRisk(h.propagation)).toContain('propagation=');
    const cmp = compareTemporalConsistency(w, w);
    expect(explainTemporalConsistency(cmp)).toContain('temporal=');
    expect(explainHistoricalParityGap('dashboard_profile_save', 5.55)).toContain('5.550');
  });

  // X
  it('X) guards individuais retornam [] em janela canônica', () => {
    const w = buildRuntimeHistory('dashboard_profile_save', [consistentTrace()]);
    expect(assertRuntimeHistoryIntegrity(w)).toEqual([]);
    expect(assertNoHistoricalPromotionLeak(w)).toEqual([]);
    const cmp = compareTemporalConsistency(w, w);
    expect(assertNoUnsafeTemporalRegression(cmp)).toEqual([]);
    expect(assertTemporalConsistencyIntegrity(cmp)).toEqual([]);
    expect(assertRuntimeLineageConsistency('dashboard_profile_save', [consistentTrace()])).toEqual([]);
    expect(assertPropagationIntegrity('dashboard_profile_save', [consistentTrace()])).toEqual([]);
  });

  // Y
  it('Y) guards detectam orphan e ciclo', () => {
    expect(assertRuntimeLineageConsistency('avatar_sync', [orphanTrace()])).not.toEqual([]);
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('a', { dependsOn: ['b'] }));
    t = appendTraceStep(t, okStep('b', { dependsOn: ['a'] }));
    t = finalizeRuntimeTrace(t);
    expect(assertPropagationIntegrity('dashboard_profile_save', [t])).not.toEqual([]);
  });

  // Z
  it('Z) assertAllRuntimeHistoryIntegrity([]) retorna []; adapters não mutam', () => {
    expect(assertAllRuntimeHistoryIntegrity([])).toEqual([]);
    const traces = [consistentTrace()];
    const w1 = adaptRuntimeRecorderToHistory('dashboard_profile_save', traces);
    expect(w1.entries.length).toBe(1);
    expect(adaptSimulationToHistory('dashboard_profile_save').entries.length).toBe(0);
    expect(adaptCertificationToHistory('dashboard_profile_save').entries.length).toBe(0);
    expect(adaptGovernanceToHistory('dashboard_profile_save').entries.length).toBe(0);
    expect(adaptPromotionToHistory('dashboard_profile_save').entries.length).toBe(0);
    // EVENTUAL flow não promovido a NOT SAFE quando trace canônico
    const sim = compareHistoryToSimulation(w1, traces);
    expect(sim.parityRegression).toBe(false);
    // invariantes de execução permanecem false
    for (const e of w1.entries) {
      expect(e.liveExecution).toBe(false);
      expect(e.persisted).toBe(false);
      expect(e.retry).toBe(false);
      expect(e.background).toBe(false);
      expect(e.realUserMutation).toBe(false);
    }
    const full = assertAllRuntimeHistoryIntegrity([
      { flow: 'dashboard_profile_save', traces: [consistentTrace()] },
    ]);
    expect(full).toEqual([]);
  });
});
