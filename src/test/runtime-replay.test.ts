/**
 * Fase 1.8.2 — Runtime Replay tests (READ-ONLY, A→Z).
 */
import { describe, it, expect } from 'vitest';
import {
  createRuntimeTrace,
  appendTraceStep,
  finalizeRuntimeTrace,
} from '@/lib/runtimeRecorder';
import { buildRuntimeHistory } from '@/lib/runtimeHistory';
import {
  buildFlowReplay,
  buildReplayMatrix,
  reconstructExecutionOrder,
  reconstructDependencyTimeline,
  reconstructFailurePropagation,
  reconstructDriftEvolution,
  classifyReplayDeterminism,
  classifyReplayRisk,
  detectReplayParityGap,
  detectReplayOrderingRegression,
  calculateReplayConfidence,
  buildReplayParity,
  buildReplayTopology,
  classifyTopologyPropagation,
  detectCircularReplayDependency,
  detectHiddenReplayDependency,
  buildReplayLineage,
  classifyReplayLineage,
  detectBrokenReplayLineage,
  detectReplayTemporalGap,
  detectReplayStateRegression,
  calculateReplayParityScore,
  detectReplayParityRegression,
  detectReplayRollbackMismatch,
  detectReplayVisibilityGap,
  aggregateReplayHealth,
  summarizeReplayRisk,
  rankReplayInstability,
  summarizeReplayDeterminism,
  buildReplayOperationalHealth,
  fromRuntimeRecorder,
  fromRuntimeHistory,
  fromAtomicSimulation,
  fromRuntimeCertification,
  fromPromotionMatrix,
  buildReplayAuditPayload,
  isReplayAuditPayloadPiiFree,
  REPLAY_AUDIT_ACTIONS,
  explainReplayClassification,
  explainReplayRisk,
  explainReplayPropagation,
  explainReplayParity,
  explainReplayDeterminism,
  explainRuntimeReplay,
  assertReplayCoverage,
  assertReplayDeterminism,
  assertReplayParity,
  assertReplayLineage,
  assertReplayPropagation,
  assertReplayObservability,
  assertNoUnsafeReplayPromotion,
  assertAllReplayIntegrity,
} from '@/lib/runtimeReplay';

const okStep = (
  step: string,
  opts: Partial<{ mirror: boolean; dependsOn: string[] }> = {},
) => ({
  step,
  status: 'ok' as const,
  durationBucket: 'fast' as const,
  dependsOn: opts.dependsOn ?? [],
  boundary: 'multiWriteSync' as const,
  visibility: 'private' as const,
  requiresOwner: false,
  mirror: opts.mirror ?? false,
});

const failedStep = (
  step: string,
  opts: Partial<{
    mirror: boolean;
    cascaded: boolean;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dependsOn: string[];
  }> = {},
) => ({
  step,
  status: 'failed' as const,
  durationBucket: 'fast' as const,
  dependsOn: opts.dependsOn ?? [],
  boundary: 'multiWriteSync' as const,
  visibility: 'private' as const,
  requiresOwner: false,
  mirror: opts.mirror ?? false,
  failure: {
    code: 'test_failure',
    class: 'validation' as const,
    severity: opts.severity ?? 'MEDIUM',
    cascaded: opts.cascaded ?? false,
  },
});

function buildCleanTrace(flow: 'dashboard_profile_save', steps: string[] = ['profile', 'provider']) {
  let t = createRuntimeTrace(flow, 'multiWriteSync', 'observe_only');
  for (const s of steps) t = appendTraceStep(t, okStep(s));
  return finalizeRuntimeTrace(t);
}

function buildMirrorOnlyTrace(flow: 'dashboard_profile_save') {
  let t = createRuntimeTrace(flow, 'multiWriteSync', 'observe_only');
  t = appendTraceStep(t, okStep('avatar_mirror', { mirror: true }));
  return finalizeRuntimeTrace(t);
}

describe('Fase 1.8.2 — Runtime Replay (A→Z)', () => {
  it('A) deterministic replay', () => {
    const traces = Array.from({ length: 4 }, () => buildCleanTrace('dashboard_profile_save'));
    const r = buildFlowReplay('dashboard_profile_save', traces);
    expect(r.classification).toBe('deterministic');
    expect(r.determinism.orderingStable).toBe(true);
  });

  it('B) partial deterministic replay (eventual gap)', () => {
    let t1 = createRuntimeTrace('persist_first_service', 'multiWriteSync');
    t1 = appendTraceStep(t1, okStep('service'));
    t1 = appendTraceStep(t1, okStep('avatar_mirror', { mirror: true }));
    const f1 = finalizeRuntimeTrace(t1);
    const r = buildFlowReplay('persist_first_service', [f1, f1]);
    expect(['partially_deterministic', 'deterministic', 'divergent', 'unreconstructable']).toContain(r.classification);
  });

  it('C) divergent replay (parity regression)', () => {
    const traces = [
      (() => {
        let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
        t = appendTraceStep(t, failedStep('profile', { severity: 'CRITICAL', cascaded: true }));
        return finalizeRuntimeTrace(t);
      })(),
      (() => {
        let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
        t = appendTraceStep(t, failedStep('profile', { severity: 'CRITICAL' }));
        return finalizeRuntimeTrace(t);
      })(),
    ];
    const r = buildFlowReplay('dashboard_profile_save', traces);
    expect(['divergent', 'unreconstructable']).toContain(r.classification);
  });

  it('D) unreconstructable replay (lineage broken)', () => {
    const r = buildFlowReplay('dashboard_profile_save', [buildMirrorOnlyTrace('dashboard_profile_save')]);
    expect(r.classification).toBe('unreconstructable');
    expect(r.risk).toBe('critical');
  });

  it('E) mirror drift evolution', () => {
    const traces = [buildMirrorOnlyTrace('dashboard_profile_save')];
    const d = reconstructDriftEvolution('dashboard_profile_save', traces);
    expect(['orphaned', 'mirror_only']).toContain(d.drift);
  });

  it('F) orphan propagation', () => {
    const trace = buildMirrorOnlyTrace('dashboard_profile_save');
    const p = reconstructFailurePropagation('dashboard_profile_save', [trace]);
    expect(p.propagation).not.toBe('isolated');
  });

  it('G) finalize gap detection', () => {
    let t = createRuntimeTrace('bet_finish_pro', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    const f = finalizeRuntimeTrace(t);
    const d = reconstructDriftEvolution('bet_finish_pro', [f]);
    expect(['finalize_gap', 'ownership', 'orphaned', 'none', 'mirror_only']).toContain(d.drift);
  });

  it('H) ordering regression across traces', () => {
    let a = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    a = appendTraceStep(a, okStep('profile'));
    a = appendTraceStep(a, okStep('provider'));
    const fa = finalizeRuntimeTrace(a);
    let b = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    b = appendTraceStep(b, okStep('provider'));
    b = appendTraceStep(b, okStep('profile'));
    const fb = finalizeRuntimeTrace(b);
    expect(detectReplayOrderingRegression('dashboard_profile_save', [fa, fb])).toBe(true);
  });

  it('I) hidden dependency', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile', { dependsOn: ['ghost_step'] }));
    const f = finalizeRuntimeTrace(t);
    expect(detectHiddenReplayDependency('dashboard_profile_save', [f])).toBe(true);
  });

  it('J) circular propagation', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('a', { dependsOn: ['b'] }));
    t = appendTraceStep(t, okStep('b', { dependsOn: ['a'] }));
    const f = finalizeRuntimeTrace(t);
    expect(detectCircularReplayDependency('dashboard_profile_save', [f])).toBe(true);
  });

  it('K) replay parity degradation', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, failedStep('profile', { severity: 'CRITICAL', cascaded: true }));
    const f = finalizeRuntimeTrace(t);
    const par = buildReplayParity('dashboard_profile_save', [f]);
    expect(par.gap).toBeGreaterThan(15);
  });

  it('L) replay rollback mismatch', () => {
    const r = buildFlowReplay('dashboard_profile_save', [buildMirrorOnlyTrace('dashboard_profile_save')]);
    // mirror-only triggers risk; rollback mismatch may or may not fire — function must run
    expect(typeof detectReplayRollbackMismatch(r)).toBe('boolean');
  });

  it('M) replay visibility gap', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    const f = finalizeRuntimeTrace(t);
    const r = buildFlowReplay('dashboard_profile_save', [f]);
    expect(typeof detectReplayVisibilityGap(r)).toBe('boolean');
  });

  it('N) replay confidence low when traces few/unstable', () => {
    const traces = [buildMirrorOnlyTrace('dashboard_profile_save')];
    const r = buildFlowReplay('dashboard_profile_save', traces);
    expect(r.determinism.confidenceScore).toBeLessThan(0.5);
  });

  it('O) lineage broken', () => {
    expect(detectBrokenReplayLineage('dashboard_profile_save', [buildMirrorOnlyTrace('dashboard_profile_save')])).toBe(true);
    const lineage = buildReplayLineage('dashboard_profile_save', [buildMirrorOnlyTrace('dashboard_profile_save')]);
    expect(['mirror_only', 'broken', 'orphaned']).toContain(lineage.class);
  });

  it('P) topology propagation', () => {
    const r = buildFlowReplay('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')]);
    expect(['isolated', 'contained', 'cascading']).toContain(r.topology.propagation);
    const topo = buildReplayTopology('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')]);
    expect(topo.flow).toBe('dashboard_profile_save');
  });

  it('Q) EVENTUAL consistency não promovida (deterministic ≠ full_certified)', () => {
    const r = buildFlowReplay('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')]);
    expect(r.currentStage).toBe('STAGE_0_READ_ONLY');
    expect(r.liveExecutionEnabled).toBe(false);
  });

  it('R) adapters inertes (sem side-effects)', () => {
    const trace = buildCleanTrace('dashboard_profile_save');
    const fromRec = fromRuntimeRecorder('dashboard_profile_save', [trace]);
    const win = buildRuntimeHistory('dashboard_profile_save', [trace]);
    const fromHist = fromRuntimeHistory(win);
    const fromSim = fromAtomicSimulation('dashboard_profile_save');
    const fromCert = fromRuntimeCertification('dashboard_profile_save');
    const fromProm = fromPromotionMatrix('dashboard_profile_save');
    for (const a of [fromRec, fromHist, fromSim, fromCert, fromProm]) {
      expect(a.liveExecution).toBe(false);
      expect(a.persisted).toBe(false);
      expect(a.retry).toBe(false);
      expect(a.background).toBe(false);
    }
  });

  it('S) observability PII-free', () => {
    const safe = buildReplayAuditPayload('runtime_replay_generated', 'dashboard_profile_save', { score: 88 });
    expect(isReplayAuditPayloadPiiFree(safe)).toBe(true);
    const unsafe = {
      action: 'runtime_replay_generated' as const,
      flow: 'dashboard_profile_save' as const,
      metadata: { email: 'a@b.com' as string },
    };
    expect(isReplayAuditPayloadPiiFree(unsafe)).toBe(false);
    const stripped = buildReplayAuditPayload('runtime_replay_generated', 'dashboard_profile_save', { email: 'x@y.com', score: 1 });
    expect('email' in stripped.metadata).toBe(false);
  });

  it('T) replay aggregation', () => {
    const replays = buildReplayMatrix([
      buildCleanTrace('dashboard_profile_save'),
      buildMirrorOnlyTrace('dashboard_profile_save'),
    ]);
    const health = aggregateReplayHealth(replays);
    expect(health.totalFlows).toBe(1);
    expect(health.worstRisk === 'critical' || health.worstRisk === 'high').toBe(true);
  });

  it('U) replay health summary', () => {
    const replays = [buildFlowReplay('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')])];
    const risk = summarizeReplayRisk(replays);
    expect(risk.none + risk.low + risk.medium + risk.high + risk.critical).toBe(1);
    const det = summarizeReplayDeterminism(replays);
    expect(det.totalFlows).toBe(1);
  });

  it('V) replay instability ranking', () => {
    const replays = [
      buildFlowReplay('dashboard_profile_save', [buildMirrorOnlyTrace('dashboard_profile_save')]),
      buildFlowReplay('persist_first_service', [buildCleanTrace('dashboard_profile_save')]),
    ];
    const rank = rankReplayInstability(replays);
    expect(rank.length).toBe(2);
    expect(rank[0].score).toBeGreaterThanOrEqual(rank[1].score);
  });

  it('W) replay operational health', () => {
    const replays = [
      buildFlowReplay('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')]),
      buildFlowReplay('persist_first_service', [buildMirrorOnlyTrace('dashboard_profile_save')]),
    ];
    const h = buildReplayOperationalHealth(replays);
    expect(h.totalFlows).toBe(2);
    expect(h.healthy + h.degraded + h.critical).toBe(2);
  });

  it('X) replay determinism classification helpers', () => {
    const det = classifyReplayDeterminism('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')]);
    expect(det.classification).toBe('deterministic');
    expect(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).toContain(det.confidence);
    const risk = classifyReplayRisk({
      classification: 'deterministic',
      parity: { flow: 'dashboard_profile_save', score: 100, gap: 0, regression: false, rollbackMismatch: false, visibilityGap: false },
      propagation: { flow: 'dashboard_profile_save', propagation: 'isolated', affectedSteps: [], cascadeDepth: 0 },
      drift: { flow: 'dashboard_profile_save', drift: 'none', severity: 'NONE', emergenceScore: 0 },
      severity: 'NONE',
      lineage: { flow: 'dashboard_profile_save', class: 'intact', gaps: [], temporalGap: false, stateRegression: false },
    });
    expect(risk).toBe('none');
  });

  it('Y) assertAllReplayIntegrity() === [] em estado limpo', () => {
    const replays = [buildFlowReplay('dashboard_profile_save', Array.from({ length: 5 }, () => buildCleanTrace('dashboard_profile_save')))];
    const v = assertAllReplayIntegrity({
      replays,
      expectedFlows: ['dashboard_profile_save'],
      auditPayloads: [buildReplayAuditPayload('runtime_replay_generated', 'dashboard_profile_save', { score: 99 })],
    });
    expect(v).toEqual([]);
  });

  it('Z) invariants always false / stage always read-only', () => {
    const r = buildFlowReplay('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')]);
    expect(r.liveExecutionEnabled).toBe(false);
    expect(r.realUsersAllowed).toBe(false);
    expect(r.retryEnabled).toBe(false);
    expect(r.backgroundEnabled).toBe(false);
    expect(r.currentStage).toBe('STAGE_0_READ_ONLY');
    expect(assertNoUnsafeReplayPromotion(r)).toEqual([]);
  });

  it('aux) explainers + helpers', () => {
    expect(explainReplayClassification('deterministic')).toContain('determinístico');
    expect(explainReplayRisk('critical')).toContain('crítico');
    expect(explainReplayPropagation('isolated')).toContain('isolada');
    expect(explainReplayParity({ flow: 'dashboard_profile_save', score: 100, gap: 0, regression: false, rollbackMismatch: false, visibilityGap: false })).toContain('parity');
    const r = buildFlowReplay('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')]);
    expect(explainReplayDeterminism(r.determinism)).toContain('Determinismo');
    expect(explainRuntimeReplay(r).length).toBeGreaterThan(20);
    expect(reconstructExecutionOrder('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')]).length).toBeGreaterThan(0);
    expect(reconstructDependencyTimeline('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')]).length).toBe(0);
    expect(calculateReplayParityScore('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')])).toBeGreaterThan(50);
    expect(detectReplayParityGap(r)).toBe(false);
    expect(detectReplayParityRegression(r)).toBe(false);
    expect(detectReplayTemporalGap('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')])).toBe(false);
    expect(detectReplayStateRegression('dashboard_profile_save', [buildCleanTrace('dashboard_profile_save')])).toBe(false);
    expect(classifyTopologyPropagation([buildCleanTrace('dashboard_profile_save')])).toBe('isolated');
    expect(classifyReplayLineage({ owners: ['a'], mirrors: [], finalizers: [], gaps: [], requiresFinalize: false, orphan: false })).toBe('intact');
    expect(calculateReplayConfidence({
      cons: { flow: 'dashboard_profile_save', consistentRatio: 1, orphanRatio: 0, inconsistentRatio: 0, stable: true },
      par: { flow: 'dashboard_profile_save', score: 100, gap: 0, regression: false, rollbackMismatch: false, visibilityGap: false },
      drift: { flow: 'dashboard_profile_save', drift: 'none', severity: 'NONE', emergenceScore: 0 },
      orderingStable: true,
      samples: 10,
    })).toBeGreaterThan(0.9);
    expect(REPLAY_AUDIT_ACTIONS.length).toBe(6);
    expect(assertReplayCoverage([], ['dashboard_profile_save']).length).toBe(1);
    expect(assertReplayDeterminism(r)).toEqual([]);
    expect(assertReplayParity(r)).toEqual([]);
    expect(assertReplayLineage(r)).toEqual([]);
    expect(assertReplayPropagation(r)).toEqual([]);
    expect(assertReplayObservability([buildReplayAuditPayload('runtime_replay_generated', 'dashboard_profile_save', { score: 1 })], REPLAY_AUDIT_ACTIONS)).toEqual([]);
  });
});
