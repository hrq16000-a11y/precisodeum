/**
 * Fase 1.8.3 — Runtime Causality tests (READ-ONLY, A→Z + 2 aux = 28).
 */
import { describe, it, expect } from 'vitest';
import {
  createRuntimeTrace,
  appendTraceStep,
  finalizeRuntimeTrace,
} from '@/lib/runtimeRecorder';
import {
  buildCausalityGraph,
  buildFlowCausality,
  buildFailurePropagationGraph,
  buildTemporalDependencyGraph,
  buildReplayDependencyGraph,
  classifyCausalityGraph,
  classifyPropagationMode,
  classifyFailureOrigin,
  calculateCausalityStrength,
  calculatePropagationDepth,
  detectHiddenDependencyCause,
  detectRecursivePropagation,
  detectCircularCausality,
  detectFinalizeCascade,
  detectMirrorCascade,
  detectOrderingCascade,
  detectReplayCascade,
  detectTemporalEscalation,
  detectBlastRadiusEscalation,
  reconstructReplayCausality,
  reconstructTemporalCausality,
  reconstructPropagationTimeline,
  detectReplayCauseRegression,
  detectReplayCauseInstability,
  detectDriftCausality,
  detectDriftEscalation,
  classifyDriftPropagation,
  calculateDriftContainment,
  detectUnboundedDrift,
  aggregateCausalityHealth,
  summarizeCausalityRisk,
  rankCausalityInstability,
  summarizePropagationRisk,
  summarizeFailureOrigins,
  summarizeCausalityClassification,
  buildCausalityTopology,
  detectTopologyCycles,
  detectHiddenTopologyDependencies,
  classifyTopologyRisk,
  fromRuntimeReplay,
  fromRuntimeHistory,
  fromRuntimeRecorder,
  fromRuntimeSimulation,
  fromRuntimeCertification,
  buildCausalityAuditPayload,
  isCausalityAuditPayloadPiiFree,
  CAUSALITY_AUDIT_ACTIONS,
  explainCausalityClassification,
  explainFailureOrigin,
  explainPropagationMode,
  explainCausalityStrength,
  explainPropagationDepth,
  explainRuntimeCausality,
  assertCausalityCoverage,
  assertNoCircularCausalityLeaks,
  assertNoUnsafePropagation,
  assertReplayCausalityIntegrity,
  assertDriftContainment,
  assertObservabilityPurity,
  assertNoUnsafeCausalityPromotion,
  assertAllCausalityIntegrity,
} from '@/lib/runtimeCausality';

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
  opts: Partial<{ mirror: boolean; cascaded: boolean; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; dependsOn: string[] }> = {},
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

function cleanTrace(flow: 'dashboard_profile_save' | 'persist_first_service' | 'bet_finish_pro', steps = ['profile', 'provider']) {
  let t = createRuntimeTrace(flow, 'multiWriteSync', 'observe_only');
  for (const s of steps) t = appendTraceStep(t, okStep(s));
  return finalizeRuntimeTrace(t);
}

function mirrorOnlyTrace(flow: 'dashboard_profile_save') {
  let t = createRuntimeTrace(flow, 'multiWriteSync', 'observe_only');
  t = appendTraceStep(t, okStep('avatar_mirror', { mirror: true }));
  return finalizeRuntimeTrace(t);
}

describe('Fase 1.8.3 — Runtime Causality (A→Z)', () => {
  it('A) isolated causality', () => {
    const g = buildFlowCausality('dashboard_profile_save', [cleanTrace('dashboard_profile_save', ['profile'])]);
    expect(['isolated', 'dependent']).toContain(g.classification);
    expect(g.severity === 'NONE' || g.severity === 'LOW').toBe(true);
  });

  it('B) dependent causality', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    t = appendTraceStep(t, okStep('provider', { dependsOn: ['profile'] }));
    const f = finalizeRuntimeTrace(t);
    const g = buildFlowCausality('dashboard_profile_save', [f]);
    expect(['dependent', 'cascading']).toContain(g.classification);
    expect(g.edges.length).toBeGreaterThan(0);
  });

  it('C) cascading causality', () => {
    const g = buildFlowCausality('dashboard_profile_save', [mirrorOnlyTrace('dashboard_profile_save')]);
    expect(['cascading', 'hidden', 'dependent', 'isolated']).toContain(g.classification);
  });

  it('D) recursive causality', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('a', { dependsOn: ['a'] }));
    const f = finalizeRuntimeTrace(t);
    expect(detectRecursivePropagation('dashboard_profile_save', [f])).toBe(true);
    const g = buildFlowCausality('dashboard_profile_save', [f]);
    expect(['recursive', 'circular']).toContain(g.classification);
  });

  it('E) circular causality', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('a', { dependsOn: ['b'] }));
    t = appendTraceStep(t, okStep('b', { dependsOn: ['a'] }));
    const f = finalizeRuntimeTrace(t);
    expect(detectCircularCausality('dashboard_profile_save', [f])).toBe(true);
    const g = buildFlowCausality('dashboard_profile_save', [f]);
    expect(g.classification).toBe('circular');
    expect(g.severity).toBe('CRITICAL');
  });

  it('F) hidden dependency', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile', { dependsOn: ['ghost'] }));
    const f = finalizeRuntimeTrace(t);
    expect(detectHiddenDependencyCause('dashboard_profile_save', [f])).toBe(true);
    const g = buildFlowCausality('dashboard_profile_save', [f]);
    expect(g.classification).toBe('hidden');
  });

  it('G) finalize cascade', () => {
    let t = createRuntimeTrace('bet_finish_pro', 'multiWriteSync');
    t = appendTraceStep(t, failedStep('finalize', { severity: 'CRITICAL', cascaded: true }));
    const f = finalizeRuntimeTrace(t);
    expect(detectFinalizeCascade('bet_finish_pro', [f])).toBe(true);
  });

  it('H) mirror cascade', () => {
    expect(detectMirrorCascade('dashboard_profile_save', [mirrorOnlyTrace('dashboard_profile_save')])).toBe(true);
  });

  it('I) replay cascade (ordering signatures differ)', () => {
    let a = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    a = appendTraceStep(a, okStep('profile'));
    a = appendTraceStep(a, okStep('provider'));
    const fa = finalizeRuntimeTrace(a);
    let b = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    b = appendTraceStep(b, okStep('provider'));
    b = appendTraceStep(b, okStep('profile'));
    const fb = finalizeRuntimeTrace(b);
    expect(detectReplayCascade('dashboard_profile_save', [fa, fb])).toBe(true);
  });

  it('J) ordering cascade', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('finalize'));
    t = appendTraceStep(t, okStep('mirror_x', { mirror: true }));
    const f = finalizeRuntimeTrace(t);
    expect(detectOrderingCascade('dashboard_profile_save', [f])).toBe(true);
  });

  it('K) temporal escalation', () => {
    let a = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    a = appendTraceStep(a, okStep('profile'));
    const fa = finalizeRuntimeTrace(a);
    let b = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    b = appendTraceStep(b, failedStep('profile', { severity: 'CRITICAL', cascaded: true }));
    const fb = finalizeRuntimeTrace(b);
    expect(detectTemporalEscalation('dashboard_profile_save', [fa, fb])).toBe(true);
    const tmp = buildTemporalDependencyGraph('dashboard_profile_save', [fa, fb]);
    expect(tmp.escalating).toBe(true);
  });

  it('L) blast escalation', () => {
    let a = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    a = appendTraceStep(a, failedStep('profile', { severity: 'CRITICAL', cascaded: true }));
    const fa = finalizeRuntimeTrace(a);
    let b = createRuntimeTrace('persist_first_service', 'multiWriteSync');
    b = appendTraceStep(b, failedStep('service', { severity: 'CRITICAL' }));
    const fb = finalizeRuntimeTrace(b);
    const g = buildFlowCausality('dashboard_profile_save', [fa, fb]);
    expect(detectBlastRadiusEscalation(g)).toBe(true);
  });

  it('M) orphan propagation', () => {
    const g = buildFlowCausality('dashboard_profile_save', [mirrorOnlyTrace('dashboard_profile_save')]);
    expect(g.mirror.desynced).toBe(true);
    expect(g.failureCauses.some((c) => c.origin === 'orphan_state')).toBe(true);
  });

  it('N) drift escalation', () => {
    let a = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    a = appendTraceStep(a, okStep('profile'));
    const fa = finalizeRuntimeTrace(a);
    const fb = mirrorOnlyTrace('dashboard_profile_save');
    expect(detectDriftEscalation('dashboard_profile_save', [fa, fb])).toBe(true);
  });

  it('O) drift containment', () => {
    const score = calculateDriftContainment('dashboard_profile_save', [cleanTrace('dashboard_profile_save')]);
    expect(score).toBeGreaterThan(0.9);
    expect(detectUnboundedDrift('dashboard_profile_save', [cleanTrace('dashboard_profile_save')])).toBe(false);
    const d = detectDriftCausality('dashboard_profile_save', [cleanTrace('dashboard_profile_save')]);
    expect(d.unbounded).toBe(false);
    expect(['direct', 'eventual', 'delayed', 'recursive']).toContain(classifyDriftPropagation('dashboard_profile_save', [cleanTrace('dashboard_profile_save')]));
  });

  it('P) replay causality regression', () => {
    let a = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    a = appendTraceStep(a, okStep('profile'));
    const fa = finalizeRuntimeTrace(a);
    let b = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    b = appendTraceStep(b, failedStep('profile', { severity: 'CRITICAL', cascaded: true }));
    const fb = finalizeRuntimeTrace(b);
    expect(detectReplayCauseRegression('dashboard_profile_save', [fa, fb])).toBe(true);
  });

  it('Q) replay instability', () => {
    let a = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    a = appendTraceStep(a, okStep('profile'));
    a = appendTraceStep(a, okStep('provider'));
    const fa = finalizeRuntimeTrace(a);
    let b = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    b = appendTraceStep(b, okStep('provider'));
    b = appendTraceStep(b, okStep('profile'));
    const fb = finalizeRuntimeTrace(b);
    expect(detectReplayCauseInstability('dashboard_profile_save', [fa, fb])).toBe(true);
  });

  it('R) topology cycle', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('a', { dependsOn: ['b'] }));
    t = appendTraceStep(t, okStep('b', { dependsOn: ['a'] }));
    const f = finalizeRuntimeTrace(t);
    expect(detectTopologyCycles('dashboard_profile_save', [f])).toBe(true);
    const topo = buildCausalityTopology('dashboard_profile_save', [f]);
    expect(topo.cycles).toBe(true);
    expect(topo.risk).toBe('CRITICAL');
  });

  it('S) hidden topology dependency', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile', { dependsOn: ['ghost'] }));
    const f = finalizeRuntimeTrace(t);
    expect(detectHiddenTopologyDependencies('dashboard_profile_save', [f])).toBe(true);
    expect(classifyTopologyRisk({ cycles: false, hidden: true, orphan: false })).toBe('HIGH');
  });

  it('T) propagation depth', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, failedStep('profile', { severity: 'HIGH', cascaded: true }));
    const f = finalizeRuntimeTrace(t);
    const g = buildFlowCausality('dashboard_profile_save', [f]);
    expect(calculatePropagationDepth(g)).toBeGreaterThanOrEqual(1);
    const prop = buildFailurePropagationGraph('dashboard_profile_save', [f]);
    expect(prop.affectedSteps.length).toBeGreaterThan(0);
  });

  it('U) causality aggregation', () => {
    const graphs = buildCausalityGraph([
      cleanTrace('dashboard_profile_save'),
      mirrorOnlyTrace('dashboard_profile_save'),
    ]);
    const h = aggregateCausalityHealth(graphs);
    expect(h.totalFlows).toBe(1);
    expect(h.healthy + h.degraded + h.critical).toBe(1);
    const sum = summarizeCausalityClassification(graphs);
    expect(sum.totalFlows).toBe(1);
    const ori = summarizeFailureOrigins(graphs);
    expect(typeof ori.orphan_state).toBe('number');
    const prop = summarizePropagationRisk(graphs);
    expect(Object.values(prop).reduce((s, n) => s + n, 0)).toBe(1);
    const risk = summarizeCausalityRisk(graphs);
    expect(Object.values(risk).reduce((s, n) => s + n, 0)).toBe(1);
  });

  it('V) instability ranking', () => {
    const graphs = [
      buildFlowCausality('dashboard_profile_save', [mirrorOnlyTrace('dashboard_profile_save')]),
      buildFlowCausality('persist_first_service', [cleanTrace('persist_first_service')]),
    ];
    const rank = rankCausalityInstability(graphs);
    expect(rank.length).toBe(2);
    expect(rank[0].score).toBeGreaterThanOrEqual(rank[1].score);
  });

  it('W) observability PII-free', () => {
    const safe = buildCausalityAuditPayload('runtime_causality_generated', 'dashboard_profile_save', { score: 99 });
    expect(isCausalityAuditPayloadPiiFree(safe)).toBe(true);
    const unsafe = {
      action: 'runtime_causality_generated' as const,
      flow: 'dashboard_profile_save' as const,
      metadata: { email: 'x@y.com' as string },
    };
    expect(isCausalityAuditPayloadPiiFree(unsafe)).toBe(false);
    const stripped = buildCausalityAuditPayload('runtime_causality_generated', 'dashboard_profile_save', { email: 'x@y.com', score: 1 });
    expect('email' in stripped.metadata).toBe(false);
    expect(CAUSALITY_AUDIT_ACTIONS.length).toBe(7);
  });

  it('X) adapters inertes', () => {
    const trace = cleanTrace('dashboard_profile_save');
    const adapters = [
      fromRuntimeReplay('dashboard_profile_save', [trace]),
      fromRuntimeHistory('dashboard_profile_save', [trace]),
      fromRuntimeRecorder('dashboard_profile_save', [trace]),
      fromRuntimeSimulation('dashboard_profile_save'),
      fromRuntimeCertification('dashboard_profile_save'),
    ];
    for (const a of adapters) {
      expect(a.liveExecution).toBe(false);
      expect(a.persisted).toBe(false);
      expect(a.retry).toBe(false);
      expect(a.background).toBe(false);
    }
  });

  it('Y) assertAllCausalityIntegrity() === [] em estado limpo', () => {
    const graphs = [buildFlowCausality('dashboard_profile_save', [cleanTrace('dashboard_profile_save')])];
    const v = assertAllCausalityIntegrity({
      graphs,
      expectedFlows: ['dashboard_profile_save'],
      auditPayloads: [buildCausalityAuditPayload('runtime_causality_generated', 'dashboard_profile_save', { score: 1 })],
    });
    expect(v).toEqual([]);
  });

  it('Z) invariants always false / stage always read-only', () => {
    const g = buildFlowCausality('dashboard_profile_save', [cleanTrace('dashboard_profile_save')]);
    expect(g.liveExecutionEnabled).toBe(false);
    expect(g.realUsersAllowed).toBe(false);
    expect(g.retryEnabled).toBe(false);
    expect(g.backgroundEnabled).toBe(false);
    expect(g.currentStage).toBe('STAGE_0_READ_ONLY');
    expect(assertNoUnsafeCausalityPromotion(g)).toEqual([]);
  });

  it('aux1) classification helpers + explainers', () => {
    expect(classifyCausalityGraph({ edges: [], chains: [], hasOrphan: false })).toBe('isolated');
    expect(classifyPropagationMode({ cascaded: false, mirror: false, hidden: false, self: true })).toBe('recursive');
    expect(classifyPropagationMode({ cascaded: false, mirror: true, hidden: false, self: false })).toBe('eventual');
    expect(classifyFailureOrigin({ step: 'finalize', mirror: false, ordering: 'expected', requiresOwner: false })).toBe('finalize_gap');
    expect(calculateCausalityStrength([])).toBe('none');
    expect(explainCausalityClassification('circular')).toContain('circular');
    expect(explainFailureOrigin('orphan_state')).toContain('órfão');
    expect(explainPropagationMode('eventual')).toContain('eventual');
    expect(explainCausalityStrength('critical')).toContain('crítica');
    expect(explainPropagationDepth(0)).toContain('nula');
    const g = buildFlowCausality('dashboard_profile_save', [cleanTrace('dashboard_profile_save')]);
    expect(explainRuntimeCausality(g).length).toBeGreaterThan(20);
  });

  it('aux2) replay/temporal/propagation reconstruction + guards', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, failedStep('profile', { severity: 'CRITICAL', cascaded: true }));
    const f = finalizeRuntimeTrace(t);
    const g = reconstructReplayCausality('dashboard_profile_save', [f]);
    expect(g.flow).toBe('dashboard_profile_save');
    expect(reconstructTemporalCausality('dashboard_profile_save', [f]).samples).toBe(1);
    expect(reconstructPropagationTimeline('dashboard_profile_save', [f]).length).toBeGreaterThan(0);
    const rep = buildReplayDependencyGraph('dashboard_profile_save', [f]);
    expect(rep.flow).toBe('dashboard_profile_save');
    expect(assertCausalityCoverage([], ['dashboard_profile_save']).length).toBe(1);
    expect(assertNoCircularCausalityLeaks(g)).toEqual([]);
    expect(assertNoUnsafePropagation(g)).toEqual([]);
    expect(assertReplayCausalityIntegrity(g)).toEqual([]);
    expect(assertDriftContainment(g)).toEqual([]);
    expect(assertObservabilityPurity(
      [buildCausalityAuditPayload('runtime_causality_generated', 'dashboard_profile_save', { score: 1 })],
      CAUSALITY_AUDIT_ACTIONS,
    )).toEqual([]);
  });
});
