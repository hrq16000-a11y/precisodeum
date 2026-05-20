/**
 * Fase 1.8.0 — Shadow Runtime Recorder tests (READ-ONLY).
 * Cobertura A→Z. Sem persistência, sem live execution.
 */
import { describe, it, expect } from 'vitest';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import {
  createRuntimeTrace,
  appendTraceStep,
  finalizeRuntimeTrace,
  classifyTraceConsistency,
  calculateTraceSeverity,
  detectTraceOrderingViolation,
  detectTraceMirrorDependency,
  buildExecutionSnapshot,
  compareExecutionSnapshots,
  detectExecutionDivergence,
  explainExecutionSnapshot,
  TRACE_CLASSES,
  UNSAFE_TRACE_CLASSES,
  isUnsafeClassification,
  classificationSeverityFloor,
  detectOutOfOrderExecution,
  detectFinalizeBeforeMirror,
  detectMirrorBeforeOwner,
  detectProgressBeforeFinalize,
  detectUnsafeDependencyOrdering,
  aggregateRuntimeTraces,
  summarizeRuntimeFailures,
  summarizeRuntimeOrdering,
  buildRuntimeTraceHealth,
  compareRuntimeToSimulation,
  compareRuntimeToBlueprint,
  compareRuntimeToCertification,
  compareRuntimeToGovernance,
  compareRuntimeToPromotion,
  calculateRuntimeParityGap,
  isRuntimeRecorderPayloadPiiFree,
  buildRuntimeTraceEnvelope,
  explainRuntimeTrace,
  explainRuntimeOrdering,
  explainRuntimeClassification,
  explainRuntimeParityGap,
  explainRuntimeHealth,
  assertRuntimeTraceIntegrity,
  assertNoUnsafeRuntimeTrace,
  assertTraceOrderingConsistency,
  assertTraceClassificationConsistency,
  assertNoRuntimePromotionLeak,
  assertAllRuntimeRecorderIntegrity,
  adaptDashboardProfileRuntimeTrace,
  adaptPersistFirstServiceRuntimeTrace,
  adaptBetFinalizeRuntimeTrace,
  adaptProfileTypeSwitchRuntimeTrace,
  adaptAvatarSyncRuntimeTrace,
  adaptAdminWriteRuntimeTrace,
} from '@/lib/runtimeRecorder';

const okStep = (
  step: string,
  opts: Partial<{ mirror: boolean; dependsOn: string[]; requiresOwner: boolean }> = {},
) => ({
  step,
  status: 'ok' as const,
  durationBucket: 'fast' as const,
  dependsOn: opts.dependsOn ?? [],
  boundary: 'multiWriteSync' as const,
  visibility: 'private' as const,
  requiresOwner: opts.requiresOwner ?? false,
  mirror: opts.mirror ?? false,
});

describe('Fase 1.8.0 — Shadow Runtime Recorder', () => {
  // A
  it('A) createRuntimeTrace devolve trace inerte read-only', () => {
    const t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    expect(t.steps).toEqual([]);
    expect(t.liveExecution).toBe(false);
    expect(t.retry).toBe(false);
    expect(t.background).toBe(false);
    expect(t.persisted).toBe(false);
    expect(t.realUserMutation).toBe(false);
    expect(t.mode).toBe('observe_only');
  });

  // B
  it('B) appendTraceStep não muta o trace original', () => {
    const t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    const t2 = appendTraceStep(t, okStep('profile'));
    expect(t.steps.length).toBe(0);
    expect(t2.steps.length).toBe(1);
    expect(t2.steps[0].order).toBe(0);
  });

  // C
  it('C) finalizeRuntimeTrace produz consistency=consistent quando tudo ok', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    t = appendTraceStep(t, okStep('provider'));
    t = finalizeRuntimeTrace(t);
    expect(t.consistency).toBe('consistent');
    expect(t.classification).toBe('SAFE');
    expect(t.severity).toBe('NONE');
  });

  // D
  it('D) detecta falha parcial', () => {
    let t = createRuntimeTrace('persist_first_service', 'onboardingProgressSync');
    t = appendTraceStep(t, okStep('provider'));
    t = appendTraceStep(t, {
      ...okStep('service'),
      status: 'failed',
      failure: { code: 'db_error', class: 'dependency', severity: 'HIGH', cascaded: true },
    });
    t = finalizeRuntimeTrace(t);
    expect(t.consistency).toBe('partial');
    expect(['PARTIAL', 'DIVERGENT']).toContain(t.classification);
  });

  // E
  it('E) classifyTraceConsistency detecta orphan via mirror-only', () => {
    let t = createRuntimeTrace('avatar_sync', 'avatarSync');
    t = appendTraceStep(t, okStep('avatar', { mirror: true }));
    t = finalizeRuntimeTrace(t);
    expect(detectTraceMirrorDependency(t)).toBe(true);
    expect(t.orphanRisk).toBe(true);
  });

  // F
  it('F) calculateTraceSeverity escala com mirror dependency', () => {
    let t = createRuntimeTrace('avatar_sync', 'avatarSync');
    t = appendTraceStep(t, okStep('avatar', { mirror: true }));
    t = finalizeRuntimeTrace(t);
    expect(['HIGH', 'CRITICAL']).toContain(t.severity);
  });

  // G
  it('G) detectTraceOrderingViolation captura out_of_order', () => {
    let t = createRuntimeTrace('persist_first_service', 'onboardingProgressSync');
    t = appendTraceStep(t, okStep('service'));
    t = appendTraceStep(t, okStep('provider'));
    t = finalizeRuntimeTrace(t);
    const ordering = detectTraceOrderingViolation(t);
    expect(ordering.violations).toContain('out_of_order');
    expect(detectOutOfOrderExecution(t)).toBe(true);
  });

  // H
  it('H) detectMirrorBeforeOwner identifica inversão', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('avatar', { mirror: true }));
    t = appendTraceStep(t, okStep('profile'));
    t = finalizeRuntimeTrace(t);
    expect(detectMirrorBeforeOwner(t)).toBe(true);
  });

  // I
  it('I) detectProgressBeforeFinalize identifica ordering quebrado', () => {
    let t = createRuntimeTrace('persist_first_service', 'onboardingProgressSync');
    t = appendTraceStep(t, okStep('progress'));
    t = appendTraceStep(t, okStep('finalize'));
    t = finalizeRuntimeTrace(t);
    expect(detectProgressBeforeFinalize(t)).toBe(true);
  });

  // J
  it('J) detectFinalizeBeforeMirror identifica corner case', () => {
    let t = createRuntimeTrace('persist_first_service', 'onboardingProgressSync');
    t = appendTraceStep(t, okStep('provider'));
    t = appendTraceStep(t, okStep('service'));
    t = appendTraceStep(t, okStep('finalize'));
    t = appendTraceStep(t, okStep('progress', { mirror: true }));
    t = finalizeRuntimeTrace(t);
    expect(detectFinalizeBeforeMirror(t)).toBe(true);
  });

  // K
  it('K) detectUnsafeDependencyOrdering captura dep faltando', () => {
    let t = createRuntimeTrace('persist_first_service', 'onboardingProgressSync');
    t = appendTraceStep(t, okStep('service', { dependsOn: ['provider'] }));
    t = finalizeRuntimeTrace(t);
    expect(detectUnsafeDependencyOrdering(t)).toBe(true);
  });

  // L
  it('L) buildExecutionSnapshot mantém invariantes', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    const snap = buildExecutionSnapshot(t);
    expect(snap.observedWrites).toBe(0); // observe_only
    expect(snap.trace.liveExecution).toBe(false);
    expect(snap.trace.persisted).toBe(false);
  });

  // M
  it('M) compareExecutionSnapshots detecta divergência', () => {
    let a = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    a = appendTraceStep(a, okStep('profile'));
    a = appendTraceStep(a, okStep('provider'));
    const snapA = buildExecutionSnapshot(a);

    let b = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    b = appendTraceStep(b, okStep('profile'));
    b = appendTraceStep(b, {
      ...okStep('provider'),
      status: 'failed',
      failure: { code: 'db', class: 'dependency', severity: 'HIGH', cascaded: false },
    });
    const snapB = buildExecutionSnapshot(b);
    expect(detectExecutionDivergence(snapA, snapB)).toBe(true);
    expect(compareExecutionSnapshots(snapA, snapB).divergent).toBe(true);
    expect(typeof explainExecutionSnapshot(snapA)).toBe('string');
  });

  // N
  it('N) classes/UNSAFE_TRACE_CLASSES e helpers', () => {
    expect(TRACE_CLASSES).toContain('SAFE');
    expect(UNSAFE_TRACE_CLASSES).toContain('CRITICAL');
    expect(isUnsafeClassification('CRITICAL')).toBe(true);
    expect(isUnsafeClassification('SAFE')).toBe(false);
    expect(classificationSeverityFloor('CRITICAL')).toBe('CRITICAL');
  });

  // O
  it('O) aggregateRuntimeTraces / summarize / health', () => {
    let t1 = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t1 = finalizeRuntimeTrace(appendTraceStep(t1, okStep('profile')));
    let t2 = createRuntimeTrace('persist_first_service', 'onboardingProgressSync');
    t2 = finalizeRuntimeTrace(
      appendTraceStep(t2, {
        ...okStep('service'),
        status: 'failed',
        failure: { code: 'x', class: 'critical', severity: 'CRITICAL', cascaded: true },
      }),
    );
    const agg = aggregateRuntimeTraces([t1, t2]);
    expect(agg.total).toBe(2);
    const fails = summarizeRuntimeFailures([t1, t2]);
    expect(fails.critical).toBeGreaterThanOrEqual(1);
    const ord = summarizeRuntimeOrdering([t1, t2]);
    expect(typeof ord.expected).toBe('number');
    const h = buildRuntimeTraceHealth([t1, t2]);
    expect(h.total).toBe(2);
    expect(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(h.worstSeverity);
  });

  // P
  it('P) compareRuntimeToSimulation/Blueprint/Certification/Governance/Promotion', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    t = appendTraceStep(t, okStep('provider'));
    t = finalizeRuntimeTrace(t);
    expect(compareRuntimeToSimulation(t).orderMatches).toBe(true);
    expect(typeof compareRuntimeToBlueprint(t).blueprintAtomic).toBe('boolean');
    expect(typeof compareRuntimeToCertification(t).certificationLevel).toBe('string');
    expect(typeof compareRuntimeToGovernance(t).freeze).toBe('string');
    expect(typeof compareRuntimeToPromotion(t).promotionEligible).toBe('boolean');
  });

  // Q
  it('Q) calculateRuntimeParityGap soma penalidades corretamente', () => {
    let t = createRuntimeTrace('persist_first_service', 'onboardingProgressSync');
    t = appendTraceStep(t, okStep('service'));
    t = appendTraceStep(t, okStep('provider'));
    t = finalizeRuntimeTrace(t);
    const gap = calculateRuntimeParityGap(t);
    expect(gap.gap).toBeGreaterThan(0);
    expect(gap.reasons.length).toBeGreaterThan(0);
    expect(gap.gap).toBeLessThanOrEqual(100);
  });

  // R
  it('R) envelope é PII-free', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    t = finalizeRuntimeTrace(t);
    const env = buildRuntimeTraceEnvelope('test', t);
    expect(isRuntimeRecorderPayloadPiiFree(env as unknown as Record<string, unknown>)).toBe(true);
    expect(isRuntimeRecorderPayloadPiiFree({ email: 'x' })).toBe(false);
    expect(env.live_execution).toBe(false);
    expect(env.persisted).toBe(false);
  });

  // S
  it('S) explainers retornam strings determinísticas', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    t = finalizeRuntimeTrace(t);
    expect(typeof explainRuntimeTrace(t)).toBe('string');
    expect(typeof explainRuntimeOrdering(t)).toBe('string');
    expect(typeof explainRuntimeClassification('SAFE')).toBe('string');
    expect(typeof explainRuntimeParityGap({ flow: t.flow, gap: 0, reasons: [] })).toBe('string');
    expect(typeof explainRuntimeHealth(buildRuntimeTraceHealth([t]))).toBe('string');
  });

  // T
  it('T) guards individuais não falham em trace canônico', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    t = finalizeRuntimeTrace(t);
    expect(assertRuntimeTraceIntegrity(t)).toEqual([]);
    expect(assertTraceOrderingConsistency(t)).toEqual([]);
    expect(assertTraceClassificationConsistency(t)).toEqual([]);
    expect(assertNoUnsafeRuntimeTrace([t])).toEqual([]);
    expect(assertNoRuntimePromotionLeak(t)).toEqual([]);
  });

  // U
  it('U) guards detectam liveExecution/persistence leaks', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    t = finalizeRuntimeTrace(t);
    const tampered = { ...t, liveExecution: true as unknown as false };
    expect(assertRuntimeTraceIntegrity(tampered as any).length).toBeGreaterThan(0);
    const persisted = { ...t, persisted: true as unknown as false };
    expect(assertNoUnsafeRuntimeTrace([persisted as any]).length).toBeGreaterThan(0);
  });

  // V
  it('V) assertAllRuntimeRecorderIntegrity([]) retorna []', () => {
    expect(assertAllRuntimeRecorderIntegrity()).toEqual([]);
    expect(assertAllRuntimeRecorderIntegrity([])).toEqual([]);
  });

  // W
  it('W) adapters cobrem todos os flows registrados', () => {
    const traces = [
      adaptDashboardProfileRuntimeTrace({ steps: [okStep('profile'), okStep('provider')] }),
      adaptPersistFirstServiceRuntimeTrace({ steps: [okStep('provider'), okStep('service'), okStep('finalize')] }),
      adaptBetFinalizeRuntimeTrace({ steps: [okStep('profile'), okStep('provider')] }, 'pro'),
      adaptBetFinalizeRuntimeTrace({ steps: [okStep('profile')] }, 'client'),
      adaptProfileTypeSwitchRuntimeTrace({ steps: [okStep('profile_type'), okStep('provider')] }),
      adaptAvatarSyncRuntimeTrace({ steps: [okStep('avatar', { mirror: true })] }),
      adaptAdminWriteRuntimeTrace({ steps: [okStep('profile')] }, 'profile'),
      adaptAdminWriteRuntimeTrace({ steps: [okStep('provider')] }, 'provider'),
    ];
    for (const t of traces) {
      expect(t.steps.length).toBeGreaterThan(0);
      expect(t.liveExecution).toBe(false);
      expect(t.persisted).toBe(false);
    }
    expect(assertAllRuntimeRecorderIntegrity(traces.filter(t => !t.mirrorDependent))).toEqual([]);
  });

  // X
  it('X) cobertura do OPERATION_REGISTRY: comparisons rodam para todos os flows', () => {
    for (const reg of OPERATION_REGISTRY) {
      let t = createRuntimeTrace(reg.flow, 'observer_only', 'observe_only');
      for (const s of reg.steps) t = appendTraceStep(t, okStep(String(s)));
      t = finalizeRuntimeTrace(t);
      const sim = compareRuntimeToSimulation(t);
      expect(sim.flow).toBe(reg.flow);
    }
  });

  // Y
  it('Y) snapshot run mantém retry/background impossíveis', () => {
    let t = createRuntimeTrace('dashboard_profile_save', 'multiWriteSync');
    t = appendTraceStep(t, okStep('profile'));
    const snap = buildExecutionSnapshot(t);
    expect(snap.trace.retry).toBe(false);
    expect(snap.trace.background).toBe(false);
  });

  // Z
  it('Z) classificação inconsistente é detectada pelo guard', () => {
    let t = createRuntimeTrace('avatar_sync', 'avatarSync');
    t = appendTraceStep(t, okStep('avatar', { mirror: true }));
    t = finalizeRuntimeTrace(t);
    const broken = { ...t, severity: 'NONE' as const };
    expect(assertTraceClassificationConsistency(broken).length).toBeGreaterThan(0);
  });
});
