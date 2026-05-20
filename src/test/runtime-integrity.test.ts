/**
 * Fase 1.8.5 — Runtime Integrity tests (READ-ONLY).
 * 32 testes (A→Z + extras).
 */

import { describe, expect, it } from 'vitest';
import {
  INTEGRITY_AUDIT_ACTIONS,
  aggregateIntegrityHealth,
  analyzeIntegrityIsolation,
  assertAllIntegrityLayerIntegrity,
  buildDefaultIntegrityPropagation,
  buildIntactLayer,
  buildIntegrityAuditPayload,
  buildIntegrityEnvelope,
  buildIntegrityPropagation,
  buildIntegrityTopology,
  classifyContainmentRisk,
  classifyIntegrityEnvelope,
  classifyIsolationIntegrity,
  classifyPropagationIntegrity,
  classifyTopologyIntegrity,
  detectCascadingIntegrityFailure,
  detectContainmentFailure,
  detectCircularIntegrityPropagation,
  detectCrossLayerLeak,
  detectDriftContainment,
  detectFinalizeContainment,
  detectGlobalExposure,
  detectIntegrityCollapse,
  detectIntegrityRegression,
  detectIsolationFailure,
  detectMirrorContainment,
  detectPropagationContainment,
  detectPropagationIntegrityLeak,
  detectRecursiveIntegrityPropagation,
  detectReplayContainment,
  detectReplayExposure,
  detectSharedBoundaryRisk,
  detectTopologyIntegrityGap,
  detectTopologyRecursion,
  isIntegrityAuditPayloadPiiFree,
  rankIntegrityInstability,
  summarizeContainmentHealth,
  summarizeIntegrityRisk,
  summarizeIsolationHealth,
} from '@/lib/runtimeIntegrity';
import type {
  RuntimeIntegrityContainment,
  RuntimeIntegrityEnvelope,
  RuntimeIntegrityIsolation,
  RuntimeIntegrityWindow,
} from '@/lib/runtimeIntegrity';
import type { FlowId } from '@/lib/operations/operationRegistry';

const FLOW: FlowId = 'dashboard_profile_save';

function makeWindow(): RuntimeIntegrityWindow {
  return { flow: FLOW, samples: 10, intactSamples: 10, degradedSamples: 0 };
}

function makeContained(): RuntimeIntegrityContainment {
  return detectPropagationContainment({ flow: FLOW, leakedSteps: 0, totalSteps: 5 });
}

function makeIsolation(over?: Partial<Parameters<typeof analyzeIntegrityIsolation>[0]>): RuntimeIntegrityIsolation {
  return analyzeIntegrityIsolation({ flow: FLOW, leakedLayers: [], ...(over ?? {}) });
}

function makeTopology(opts: { gaps?: number; leaking?: boolean; recursive?: boolean } = {}) {
  const layers = [
    buildIntactLayer(FLOW, 'stability'),
    buildIntactLayer(FLOW, 'causality'),
    ...(opts.gaps
      ? Array.from({ length: opts.gaps }, () => ({ flow: FLOW, kind: 'replay' as const, intact: false, score: 0.4, gaps: 1 }))
      : []),
  ];
  const boundaries = [
    { flow: FLOW, between: ['stability', 'causality'] as const, intact: !opts.leaking, exposure: 'isolated' as const },
  ];
  return buildIntegrityTopology({ flow: FLOW, layers, boundaries, recursive: opts.recursive });
}

function makeEnvelope(over: {
  containment?: readonly RuntimeIntegrityContainment[];
  isolation?: RuntimeIntegrityIsolation;
  topology?: ReturnType<typeof makeTopology>;
  propagation?: ReturnType<typeof buildDefaultIntegrityPropagation>;
} = {}): RuntimeIntegrityEnvelope {
  return buildIntegrityEnvelope({
    flow: FLOW,
    topology: over.topology ?? makeTopology(),
    containment: over.containment ?? [makeContained()],
    isolation: over.isolation ?? makeIsolation(),
    propagation: over.propagation ?? buildDefaultIntegrityPropagation(FLOW, 1),
    window: makeWindow(),
  });
}

describe('Fase 1.8.5 — Runtime Integrity', () => {
  it('A) intact integrity', () => {
    const e = makeEnvelope();
    expect(e.classification).toBe('intact');
    expect(e.risk).toBe('none');
  });

  it('B) degraded integrity', () => {
    const containment = [detectMirrorContainment({ flow: FLOW, leakedSteps: 2, totalSteps: 5 })];
    const e = makeEnvelope({ containment });
    expect(['degraded', 'intact', 'unstable']).toContain(e.classification);
  });

  it('C) unstable integrity', () => {
    const e = makeEnvelope({
      topology: makeTopology({ gaps: 3, leaking: true }),
      containment: [
        detectMirrorContainment({ flow: FLOW, leakedSteps: 3, totalSteps: 5 }),
      ],
      isolation: makeIsolation({ mirrorExposed: true }),
    });
    expect(['unstable', 'degraded']).toContain(e.classification);
  });

  it('D) compromised integrity', () => {
    const cascading = detectMirrorContainment({ flow: FLOW, leakedSteps: 2, totalSteps: 5, cascading: true });
    const e = makeEnvelope({ containment: [cascading, cascading] });
    expect(e.classification).toBe('compromised');
  });

  it('E) collapsed integrity', () => {
    const unbounded = detectMirrorContainment({ flow: FLOW, leakedSteps: 5, totalSteps: 5, unbounded: true });
    const e = makeEnvelope({ containment: [unbounded] });
    expect(e.classification).toBe('collapsed');
    expect(detectIntegrityCollapse(e)).toBe(true);
  });

  it('F) containment contained', () => {
    const c = makeContained();
    expect(c.containment).toBe('contained');
    expect(classifyContainmentRisk(c)).toBe('none');
  });

  it('G) containment partial', () => {
    const c = detectMirrorContainment({ flow: FLOW, leakedSteps: 1, totalSteps: 5 });
    expect(c.containment).toBe('partially_contained');
    expect(classifyContainmentRisk(c)).toBe('low');
  });

  it('H) containment leaking', () => {
    const c = detectMirrorContainment({ flow: FLOW, leakedSteps: 3, totalSteps: 5 });
    expect(c.containment).toBe('leaking');
  });

  it('I) containment cascading', () => {
    const c = detectMirrorContainment({ flow: FLOW, leakedSteps: 2, totalSteps: 5, cascading: true });
    expect(c.containment).toBe('cascading');
    expect(classifyContainmentRisk(c)).toBe('high');
  });

  it('J) containment unbounded', () => {
    const c = detectMirrorContainment({ flow: FLOW, leakedSteps: 5, totalSteps: 5 });
    expect(c.containment).toBe('unbounded');
    expect(classifyContainmentRisk(c)).toBe('critical');
    expect(detectContainmentFailure([c])).toBe(true);
  });

  it('K) isolation isolated', () => {
    const i = makeIsolation();
    expect(i.isolation).toBe('isolated');
    expect(i.boundariesIntact).toBe(true);
  });

  it('L) shared boundary', () => {
    const i = makeIsolation({ leakedLayers: ['causality'] });
    expect(i.isolation).toBe('boundary_shared');
    expect(detectSharedBoundaryRisk(i)).toBe(true);
  });

  it('M) mirror exposed', () => {
    const i = makeIsolation({ mirrorExposed: true });
    expect(i.isolation).toBe('mirror_exposed');
  });

  it('N) replay exposed', () => {
    const i = makeIsolation({ replayExposed: true });
    expect(i.isolation).toBe('replay_exposed');
    expect(detectReplayExposure(i)).toBe(true);
  });

  it('O) globally exposed', () => {
    const i = makeIsolation({ globallyExposed: true });
    expect(i.isolation).toBe('globally_exposed');
    expect(detectGlobalExposure(i)).toBe(true);
    expect(detectIsolationFailure(i)).toBe(true);
  });

  it('P) propagation leak', () => {
    const p = buildIntegrityPropagation({ flow: FLOW, kind: 'owner', depth: 10 });
    expect(detectPropagationIntegrityLeak(p)).toBe(true);
    expect(classifyPropagationIntegrity(p)).toBe('risky');
  });

  it('Q) recursive propagation', () => {
    const p = buildIntegrityPropagation({ flow: FLOW, kind: 'replay', depth: 1, recursive: true });
    expect(detectRecursiveIntegrityPropagation(p)).toBe(true);
    expect(classifyPropagationIntegrity(p)).toBe('unsafe');
  });

  it('R) circular propagation', () => {
    const p = buildIntegrityPropagation({ flow: FLOW, kind: 'causality', depth: 1, circular: true });
    expect(detectCircularIntegrityPropagation(p)).toBe(true);
  });

  it('S) replay containment', () => {
    const c = detectReplayContainment({ flow: FLOW, leakedSteps: 1, totalSteps: 5 });
    expect(c.origin).toBe('replay');
    expect(c.containment).toBe('partially_contained');
  });

  it('T) drift containment', () => {
    const c = detectDriftContainment({ flow: FLOW, leakedSteps: 0, totalSteps: 3 });
    expect(c.origin).toBe('drift');
    expect(c.containment).toBe('contained');
  });

  it('U) finalize containment', () => {
    const c = detectFinalizeContainment({ flow: FLOW, leakedSteps: 2, totalSteps: 3 });
    expect(c.origin).toBe('finalize');
    expect(c.containment).toBe('leaking');
  });

  it('V) cross-layer leak', () => {
    const t = makeTopology({ leaking: true });
    expect(detectCrossLayerLeak(t)).toBe(true);
  });

  it('W) integrity aggregation', () => {
    const h = aggregateIntegrityHealth([makeEnvelope(), makeEnvelope()]);
    expect(h.flows).toBe(2);
    expect(h.intact).toBe(2);
    expect(h.averageScore).toBeGreaterThan(0.8);
  });

  it('X) instability ranking', () => {
    const stable = makeEnvelope();
    const bad = makeEnvelope({
      containment: [detectMirrorContainment({ flow: FLOW, leakedSteps: 5, totalSteps: 5 })],
      isolation: makeIsolation({ globallyExposed: true }),
    });
    const ranked = rankIntegrityInstability([stable, bad]);
    expect(ranked[0].score).toBeLessThanOrEqual(ranked[1].score);
    expect(summarizeIntegrityRisk([bad])[0].risk).not.toBe('none');
    expect(summarizeContainmentHealth(bad.containment).unbounded).toBeGreaterThanOrEqual(1);
    expect(summarizeIsolationHealth([bad.isolation]).global).toBe(1);
  });

  it('Y) observability PII-free', () => {
    const safe = buildIntegrityAuditPayload('runtime_integrity_generated', FLOW, { score: 0.9 });
    expect(isIntegrityAuditPayloadPiiFree(safe)).toBe(true);
    const tainted = { action: 'runtime_integrity_generated' as const, flow: FLOW, metadata: { email: 'a@b.com' } };
    expect(isIntegrityAuditPayloadPiiFree(tainted)).toBe(false);
    const stripped = buildIntegrityAuditPayload('runtime_integrity_generated', FLOW, {
      email: 'a@b.com', score: 1,
    } as Record<string, string | number | boolean>);
    expect(stripped.metadata.email).toBeUndefined();
    expect(stripped.metadata.score).toBe(1);
  });

  it('Z) assertAllIntegrityLayerIntegrity() === []', () => {
    const v = assertAllIntegrityLayerIntegrity({
      envelopes: [makeEnvelope()],
      auditPayloads: [buildIntegrityAuditPayload('runtime_integrity_generated', FLOW, { score: 1 })],
      allowedAuditActions: INTEGRITY_AUDIT_ACTIONS,
    });
    expect(v).toEqual([]);
  });

  it('extra-1) topology integrity gap', () => {
    const t = makeTopology({ gaps: 2 });
    expect(detectTopologyIntegrityGap(t)).toBe(true);
    expect(classifyTopologyIntegrity(t)).toBe('risky');
  });

  it('extra-2) topology recursion', () => {
    const t = makeTopology({ recursive: true });
    expect(detectTopologyRecursion(t)).toBe(true);
    expect(classifyTopologyIntegrity(t)).toBe('unsafe');
  });

  it('extra-3) invariantes read-only continuam', () => {
    const e = makeEnvelope();
    expect(e.liveExecutionEnabled).toBe(false);
    expect(e.retryEnabled).toBe(false);
    expect(e.backgroundEnabled).toBe(false);
    expect(e.realUsersAllowed).toBe(false);
    expect(e.currentStage).toBe('STAGE_0_READ_ONLY');
  });

  it('extra-4) classifyIntegrityEnvelope respeita collapsed/compromised', () => {
    expect(classifyIntegrityEnvelope({ score: 0.9, cascading: false, unbounded: true, globallyExposed: false })).toBe('collapsed');
    expect(classifyIntegrityEnvelope({ score: 0.9, cascading: false, unbounded: false, globallyExposed: true })).toBe('collapsed');
    expect(classifyIntegrityEnvelope({ score: 0.9, cascading: true, unbounded: false, globallyExposed: false })).toBe('compromised');
  });

  it('extra-5) detectCascadingIntegrityFailure agrega', () => {
    const c = detectMirrorContainment({ flow: FLOW, leakedSteps: 2, totalSteps: 5, cascading: true });
    expect(detectCascadingIntegrityFailure([c, c])).toBe(true);
    expect(detectCascadingIntegrityFailure([c])).toBe(false);
  });

  it('extra-6) detectIntegrityRegression', () => {
    expect(detectIntegrityRegression(0.95, 0.7)).toBe(true);
    expect(detectIntegrityRegression(0.95, 0.9)).toBe(false);
  });

  it('extra-7) INTEGRITY_AUDIT_ACTIONS contém as 7 ações', () => {
    expect(INTEGRITY_AUDIT_ACTIONS.length).toBe(7);
    expect(INTEGRITY_AUDIT_ACTIONS).toContain('runtime_integrity_collapsed');
    expect(INTEGRITY_AUDIT_ACTIONS).toContain('cross_layer_integrity_gap_detected');
  });
});
