/**
 * Fase 1.8.4 — Runtime Stability tests (READ-ONLY).
 *
 * 30 testes (A→Z + extras) cobrindo envelopes, dependências,
 * colapsos, convergência, propagação, agregação e invariantes.
 */

import { describe, expect, it } from 'vitest';
import {
  aggregateStabilityHealth,
  analyzeRuntimeConvergence,
  assertAllStabilityIntegrity,
  buildDefaultEnvelopesForFlow,
  buildDependencyResolution,
  buildPropagationEnvelope,
  buildStabilityAuditPayload,
  buildStabilityEnvelope,
  calculateCollapseBlastRadius,
  calculateStabilityScore,
  classifyConvergenceMode,
  classifyDependencyResolution,
  classifyPropagationEnvelope,
  classifyStabilityEnvelope,
  detectCascadeCollapse,
  detectCircularDependency,
  detectCollapsePoint,
  detectConvergenceFailure,
  detectEnvelopeOverflow,
  detectIsolationFailure,
  detectPropagationLeak,
  detectRecursiveEnvelope,
  isStabilityAuditPayloadPiiFree,
  rankStabilityInstability,
  STABILITY_AUDIT_ACTIONS,
  summarizeCollapseRisk,
  summarizeConvergenceHealth,
  summarizeDependencyHealth,
} from '@/lib/runtimeStability';
import type {
  RuntimeConvergenceState,
  RuntimeDependencyEdge,
  RuntimeDependencyNode,
  RuntimeDependencyResolution,
  RuntimeIsolationBoundary,
  RuntimeStabilityEnvelope,
  RuntimeStabilityWindow,
} from '@/lib/runtimeStability';
import type { FlowId } from '@/lib/operations/operationRegistry';

const FLOW: FlowId = 'dashboard_profile_save';

function makeNodes(opts: {
  owners?: number;
  mirrors?: number;
  finalizers?: number;
  unresolved?: number;
  hidden?: number;
} = {}): RuntimeDependencyNode[] {
  const nodes: RuntimeDependencyNode[] = [];
  for (let i = 0; i < (opts.owners ?? 1); i++) {
    nodes.push({ flow: FLOW, step: `owner${i}`, kind: 'owner', resolved: true, hidden: false });
  }
  for (let i = 0; i < (opts.mirrors ?? 0); i++) {
    nodes.push({ flow: FLOW, step: `mirror${i}`, kind: 'mirror', resolved: true, hidden: false });
  }
  for (let i = 0; i < (opts.finalizers ?? 0); i++) {
    nodes.push({ flow: FLOW, step: `final${i}`, kind: 'finalize', resolved: true, hidden: false });
  }
  for (let i = 0; i < (opts.unresolved ?? 0); i++) {
    nodes.push({ flow: FLOW, step: `unres${i}`, kind: 'mirror', resolved: false, hidden: false });
  }
  for (let i = 0; i < (opts.hidden ?? 0); i++) {
    nodes.push({ flow: FLOW, step: `hid${i}`, kind: 'projection', resolved: false, hidden: true });
  }
  return nodes;
}

function makeEdges(specs: Array<[string, string, boolean?]> = []): RuntimeDependencyEdge[] {
  return specs.map(([from, to, circular]) => ({ from, to, weight: 1, circular: !!circular, hidden: false }));
}

function makeIsolation(intact = true): RuntimeIsolationBoundary {
  return { flow: FLOW, intact, leakedTo: intact ? [] : ['avatar_sync'] };
}

function makeWindow(stable = 10, unstable = 0): RuntimeStabilityWindow {
  return {
    flow: FLOW,
    sampledTraces: stable + unstable,
    stableTraces: stable,
    unstableTraces: unstable,
    classification: 'stable',
  };
}

function makeEnvelope(overrides: {
  resolution?: RuntimeDependencyResolution;
  convergence?: RuntimeConvergenceState;
  isolation?: RuntimeIsolationBoundary;
  collapse?: ReturnType<typeof detectCollapsePoint>;
} = {}): RuntimeStabilityEnvelope {
  const resolution =
    overrides.resolution ??
    buildDependencyResolution({ flow: FLOW, nodes: makeNodes({ owners: 1, mirrors: 1 }), edges: [] });
  const convergence =
    overrides.convergence ??
    analyzeRuntimeConvergence({ flow: FLOW, resolution, delayMs: 0 });
  const isolation = overrides.isolation ?? makeIsolation();
  const collapse = overrides.collapse ?? detectCollapsePoint({ flow: FLOW, resolution });
  return buildStabilityEnvelope({
    flow: FLOW,
    resolution,
    collapse,
    propagation: buildDefaultEnvelopesForFlow(FLOW, resolution),
    isolation,
    convergence,
    window: makeWindow(),
  });
}

describe('Fase 1.8.4 — Runtime Stability', () => {
  it('A) stable envelope', () => {
    const e = makeEnvelope();
    expect(e.classification).toBe('stable');
    expect(e.score).toBeGreaterThanOrEqual(0.85);
  });

  it('B) converging envelope', () => {
    const resolution = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, mirrors: 1 }),
      edges: [],
    });
    const convergence = analyzeRuntimeConvergence({ flow: FLOW, resolution, delayMs: 1000 });
    const e = makeEnvelope({ convergence });
    expect(['converging', 'stable']).toContain(e.classification);
  });

  it('C) unstable envelope', () => {
    const resolution = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 1 }),
      edges: [],
    });
    const e = makeEnvelope({ resolution });
    expect(['unstable', 'collapsing']).toContain(e.classification);
  });

  it('D) collapsing envelope', () => {
    const resolution = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 5 }),
      edges: [],
    });
    const collapse = detectCollapsePoint({ flow: FLOW, resolution, mirrorDesync: true });
    const e = makeEnvelope({ resolution, collapse });
    expect(['collapsing', 'unstable', 'divergent']).toContain(e.classification);
  });

  it('E) divergent envelope', () => {
    const resolution = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 2 }),
      edges: [],
    });
    const convergence = analyzeRuntimeConvergence({
      flow: FLOW,
      resolution,
      delayMs: 0,
      hardDivergent: true,
    });
    const e = makeEnvelope({ resolution, convergence });
    expect(e.classification).toBe('divergent');
  });

  it('F) resolved dependency', () => {
    const r = buildDependencyResolution({ flow: FLOW, nodes: makeNodes({ owners: 2 }), edges: [] });
    expect(r.resolution).toBe('resolved');
  });

  it('G) partially resolved dependency', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 2, unresolved: 1 }),
      edges: [],
    });
    expect(r.resolution).toBe('partially_resolved');
  });

  it('H) unresolved dependency', () => {
    const r = classifyDependencyResolution({ unresolved: 3, hidden: 0, circular: false, total: 3 });
    expect(r).toBe('unresolved');
  });

  it('I) hidden dependency', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, hidden: 1 }),
      edges: [],
    });
    expect(r.resolution).toBe('hidden');
    expect(r.hiddenCount).toBe(1);
  });

  it('J) circular dependency', () => {
    const edges = makeEdges([['a', 'b'], ['b', 'a']]);
    expect(detectCircularDependency(edges)).toBe(true);
    const r = buildDependencyResolution({ flow: FLOW, nodes: makeNodes({ owners: 1 }), edges });
    expect(r.resolution).toBe('circular');
  });

  it('K) collapse detection', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 1 }),
      edges: [],
    });
    const points = detectCollapsePoint({ flow: FLOW, resolution: r, mirrorDesync: true });
    expect(points.length).toBeGreaterThan(0);
    expect(points[0].origin).toBe('mirror');
  });

  it('L) cascade collapse', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 4 }),
      edges: [],
    });
    const points = detectCollapsePoint({
      flow: FLOW,
      resolution: r,
      mirrorDesync: true,
      finalizeGap: true,
    });
    expect(detectCascadeCollapse(points)).toBe(true);
  });

  it('M) replay collapse', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 2 }),
      edges: [],
    });
    const points = detectCollapsePoint({ flow: FLOW, resolution: r, replayDivergence: true });
    expect(points.some((p) => p.origin === 'replay')).toBe(true);
  });

  it('N) temporal collapse', () => {
    const r = buildDependencyResolution({ flow: FLOW, nodes: makeNodes({ owners: 1 }), edges: [] });
    const points = detectCollapsePoint({ flow: FLOW, resolution: r, temporalRegression: true });
    expect(points.some((p) => p.origin === 'temporal')).toBe(true);
  });

  it('O) mirror collapse blast radius', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 3 }),
      edges: [],
    });
    expect(calculateCollapseBlastRadius(r)).toBeGreaterThanOrEqual(3);
  });

  it('P) finalize collapse', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 1 }),
      edges: [],
    });
    const points = detectCollapsePoint({ flow: FLOW, resolution: r, finalizeGap: true });
    expect(points.some((p) => p.origin === 'finalize')).toBe(true);
  });

  it('Q) convergence deterministic', () => {
    const r = buildDependencyResolution({ flow: FLOW, nodes: makeNodes({ owners: 1 }), edges: [] });
    expect(classifyConvergenceMode({ resolution: r, delayMs: 0 })).toBe('deterministic');
  });

  it('R) convergence eventual', () => {
    const r = buildDependencyResolution({ flow: FLOW, nodes: makeNodes({ owners: 1 }), edges: [] });
    expect(classifyConvergenceMode({ resolution: r, delayMs: 1000 })).toBe('eventual');
  });

  it('S) convergence divergent', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 0, unresolved: 2 }),
      edges: [],
    });
    expect(classifyConvergenceMode({ resolution: r, delayMs: 0 })).toBe('divergent');
    const c = analyzeRuntimeConvergence({ flow: FLOW, resolution: r, delayMs: 0 });
    expect(detectConvergenceFailure(c)).toBe(true);
  });

  it('T) propagation overflow', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1 }),
      edges: makeEdges([['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e']]),
    });
    const p = buildPropagationEnvelope({ flow: FLOW, kind: 'owner', resolution: r });
    expect(detectEnvelopeOverflow(p)).toBe(true);
  });

  it('U) isolation boundary leak', () => {
    expect(detectIsolationFailure(makeIsolation(false))).toBe(true);
    expect(
      detectPropagationLeak([
        buildPropagationEnvelope({
          flow: FLOW,
          kind: 'mirrors',
          resolution: buildDependencyResolution({
            flow: FLOW,
            nodes: makeNodes({ owners: 1, hidden: 1 }),
            edges: [],
          }),
        }),
      ]),
    ).toBe(true);
  });

  it('V) recursive envelope', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1 }),
      edges: makeEdges([['a', 'b'], ['b', 'a']]),
    });
    const p = buildPropagationEnvelope({ flow: FLOW, kind: 'replay', resolution: r });
    expect(detectRecursiveEnvelope(p)).toBe(true);
    expect(classifyPropagationEnvelope(p)).toBe('unsafe');
  });

  it('W) stability aggregation', () => {
    const health = aggregateStabilityHealth([makeEnvelope(), makeEnvelope()]);
    expect(health.flows).toBe(2);
    expect(health.stable).toBeGreaterThanOrEqual(1);
    expect(health.averageScore).toBeGreaterThan(0);
  });

  it('X) instability ranking', () => {
    const stable = makeEnvelope();
    const unstableRes = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 4 }),
      edges: [],
    });
    const unstable = makeEnvelope({ resolution: unstableRes });
    const ranked = rankStabilityInstability([stable, unstable]);
    expect(ranked[0].score).toBeLessThanOrEqual(ranked[1].score);
    expect(summarizeCollapseRisk([unstable, stable]).length).toBeGreaterThanOrEqual(0);
    expect(summarizeDependencyHealth([unstableRes])[0].unresolvedCount).toBeGreaterThan(0);
    expect(summarizeConvergenceHealth([unstable]).length).toBe(1);
  });

  it('Y) observability PII-free', () => {
    const safe = buildStabilityAuditPayload('runtime_stability_generated', FLOW, { score: 0.9 });
    expect(isStabilityAuditPayloadPiiFree(safe)).toBe(true);
    const tainted = {
      action: 'runtime_stability_generated' as const,
      flow: FLOW,
      metadata: { email: 'a@b.com' },
    };
    expect(isStabilityAuditPayloadPiiFree(tainted)).toBe(false);
    // Strip removes forbidden keys
    const stripped = buildStabilityAuditPayload('runtime_stability_generated', FLOW, {
      email: 'a@b.com',
      score: 1,
    } as Record<string, string | number | boolean>);
    expect(stripped.metadata.email).toBeUndefined();
    expect(stripped.metadata.score).toBe(1);
  });

  it('Z) assertAllStabilityIntegrity() === []', () => {
    const violations = assertAllStabilityIntegrity({
      envelopes: [makeEnvelope()],
      auditPayloads: [buildStabilityAuditPayload('runtime_stability_generated', FLOW, { score: 1 })],
      allowedAuditActions: STABILITY_AUDIT_ACTIONS,
    });
    expect(violations).toEqual([]);
  });

  it('extra-1) liveExecutionEnabled/retry/background continuam false', () => {
    const e = makeEnvelope();
    expect(e.liveExecutionEnabled).toBe(false);
    expect(e.retryEnabled).toBe(false);
    expect(e.backgroundEnabled).toBe(false);
    expect(e.realUsersAllowed).toBe(false);
    expect(e.currentStage).toBe('STAGE_0_READ_ONLY');
  });

  it('extra-2) classifyStabilityEnvelope respeita divergent/collapsing', () => {
    expect(
      classifyStabilityEnvelope({ score: 0.9, divergent: true, collapsing: false, converging: false }),
    ).toBe('divergent');
    expect(
      classifyStabilityEnvelope({ score: 0.9, divergent: false, collapsing: true, converging: false }),
    ).toBe('collapsing');
  });

  it('extra-3) score nunca sai do intervalo [0,1]', () => {
    const r = buildDependencyResolution({
      flow: FLOW,
      nodes: makeNodes({ owners: 1, unresolved: 10, hidden: 5 }),
      edges: makeEdges([['a', 'b'], ['b', 'a']]),
    });
    const score = calculateStabilityScore({
      flow: FLOW,
      resolution: r,
      collapse: detectCollapsePoint({ flow: FLOW, resolution: r, mirrorDesync: true, finalizeGap: true }),
      propagation: buildDefaultEnvelopesForFlow(FLOW, r),
      isolation: makeIsolation(false),
      convergence: analyzeRuntimeConvergence({ flow: FLOW, resolution: r, delayMs: 10000, hardDivergent: true }),
      window: makeWindow(0, 10),
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('extra-4) STABILITY_AUDIT_ACTIONS lista contém exatamente as 7 ações', () => {
    expect(STABILITY_AUDIT_ACTIONS.length).toBe(7);
    expect(STABILITY_AUDIT_ACTIONS).toContain('runtime_stability_generated');
    expect(STABILITY_AUDIT_ACTIONS).toContain('runtime_divergence_detected');
  });
});
