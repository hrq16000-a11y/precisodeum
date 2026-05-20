/**
 * Fase 1.9.2 — Runtime Convergence Calculus tests.
 */

import { describe, expect, it } from 'vitest';
import {
  adaptCanonicalAlgebra,
  adaptGovernanceMesh,
  adaptIsolation,
  aggregateConvergenceCalculus,
  assertAllConvergenceIntegrity,
  assertConvergenceCertificationIntegrity,
  assertConvergenceDeterminism,
  assertConvergenceReadonly,
  assertNoRuntimeMutation,
  buildConvergenceEnvelope,
  buildConvergenceSpace,
  buildDefaultConvergenceInputs,
  buildDivergenceTopology,
  buildSaturationEnvelope,
  buildStabilityEnvelope,
  calculateGlobalConvergence,
  calculateResolutionDepth,
  calculateTerminalResolution,
  certifyConvergence,
  classifyResolutionStability,
  compareConvergenceSpaces,
  detectFixedPointCycles,
  detectInfiniteResolution,
  detectOscillation,
  explainConvergence,
  explainDivergence,
  resolveAllFixedPoints,
  resolveFixedPoint,
  summarizeConvergenceHealth,
  type RawConvergenceNodeInput,
} from '@/lib/runtimeConvergenceCalculus';

const node = (
  id: string,
  successors: string[] = [],
  value = 0,
  overrides: Partial<RawConvergenceNodeInput> = {},
): RawConvergenceNodeInput => ({
  id,
  layer: 'canonical-algebra',
  value,
  successors,
  ...overrides,
});

describe('convergence space', () => {
  it('builds frozen deterministic space', () => {
    const s1 = buildConvergenceSpace([node('a'), node('b')]);
    const s2 = buildConvergenceSpace([node('b'), node('a')]);
    expect(s1.frozen).toBe(true);
    expect(Object.isFrozen(s1)).toBe(true);
    expect(Object.isFrozen(s1.nodes)).toBe(true);
    expect(compareConvergenceSpaces(s1, s2)).toBe(true);
  });
});

describe('fixed point lattice', () => {
  it('classifies stable terminal point', () => {
    const s = buildConvergenceSpace([node('a')]);
    const fp = resolveFixedPoint(s, 'a');
    expect(fp.classification).toBe('STABLE');
    expect(fp.stable).toBe(true);
  });

  it('detects oscillating cycle', () => {
    const s = buildConvergenceSpace([
      node('a', ['b']),
      node('b', ['a']),
    ]);
    const cycles = detectFixedPointCycles(s);
    expect(cycles.length).toBeGreaterThan(0);
    expect(detectOscillation(resolveAllFixedPoints(s))).toBe(true);
  });

  it('computes resolution depth deterministically', () => {
    const s = buildConvergenceSpace([
      node('a', ['b']),
      node('b', ['c']),
      node('c'),
    ]);
    expect(calculateResolutionDepth(s, 'a')).toBe(2);
  });

  it('detects divergent monotonic growth', () => {
    const nodes: RawConvergenceNodeInput[] = [];
    for (let i = 0; i < 70; i += 1) {
      nodes.push(node(`n${i}`, i < 69 ? [`n${i + 1}`] : [], i));
    }
    const s = buildConvergenceSpace(nodes);
    const fp = resolveFixedPoint(s, 'n0');
    expect(['DIVERGENT', 'COLLAPSING']).toContain(fp.classification);
  });
});

describe('resolution convergence', () => {
  it('classifies all-stable as STABLE', () => {
    const s = buildConvergenceSpace([node('a'), node('b')]);
    expect(classifyResolutionStability(resolveAllFixedPoints(s))).toBe('STABLE');
  });

  it('classifies oscillating set as OSCILLATING', () => {
    const s = buildConvergenceSpace([node('a', ['b']), node('b', ['a'])]);
    expect(classifyResolutionStability(resolveAllFixedPoints(s))).toBe(
      'OSCILLATING',
    );
  });
});

describe('saturation, terminal, divergence', () => {
  it('builds saturation envelope on stable system', () => {
    const s = buildConvergenceSpace([node('a')]);
    const env = buildSaturationEnvelope(resolveAllFixedPoints(s));
    expect(env.level).toBe('NONE');
    expect(env.collapsed).toBe(false);
  });

  it('builds terminal state on stable system', () => {
    const s = buildConvergenceSpace([node('a')]);
    const t = calculateTerminalResolution(resolveAllFixedPoints(s));
    expect(t.terminality).toBe('TERMINAL');
    expect(t.infinite).toBe(false);
  });

  it('detects infinite resolution', () => {
    const nodes: RawConvergenceNodeInput[] = [];
    for (let i = 0; i < 70; i += 1) {
      nodes.push(node(`n${i}`, i < 69 ? [`n${i + 1}`] : [], i));
    }
    const s = buildConvergenceSpace(nodes);
    const fps = resolveAllFixedPoints(s);
    expect(detectInfiniteResolution(fps)).toBe(true);
  });

  it('detects topology fragmentation', () => {
    const s = buildConvergenceSpace([
      node('a', ['b']),
      node('b'),
      node('c'),
      node('d'),
    ]);
    const fps = resolveAllFixedPoints(s);
    const d = buildDivergenceTopology(s, fps);
    expect(d.fragmented).toBe(true);
  });
});

describe('stability envelope', () => {
  it('marks bounded envelope on small system', () => {
    const s = buildConvergenceSpace([node('a'), node('b')]);
    const env = buildStabilityEnvelope(resolveAllFixedPoints(s));
    expect(env.bounded).toBe(true);
    expect(env.overflow).toBe(false);
  });
});

describe('certification', () => {
  it('certifies stable system as FULL', () => {
    const s = buildConvergenceSpace([node('a'), node('b')]);
    const fps = resolveAllFixedPoints(s);
    const cert = certifyConvergence({
      classification: 'STABLE',
      fixedPoints: fps,
      saturation: buildSaturationEnvelope(fps),
      terminal: calculateTerminalResolution(fps),
      monotonic: {
        classification: 'STRICT',
        score: 1,
        regressed: false,
        reversed: false,
      },
      stability: buildStabilityEnvelope(fps),
      divergence: buildDivergenceTopology(s, fps),
      readOnlyOk: true,
    });
    expect(cert.rank).toBe('FULL');
    expect(cert.safe).toBe(true);
    expect(assertConvergenceCertificationIntegrity(cert)).toEqual([]);
  });

  it('blocks unsafe system', () => {
    const fps = [
      {
        id: 'x',
        members: ['x', 'y', 'z'],
        iterations: 80,
        stable: false,
        classification: 'DIVERGENT' as const,
      },
    ];
    const cert = certifyConvergence({
      classification: 'DIVERGENT',
      fixedPoints: fps,
      saturation: { level: 'CRITICAL', score: 1, collapsed: true, propagationSaturated: true, terminalSaturated: true },
      terminal: { terminality: 'UNRESOLVED', infinite: true, partial: false, failed: true },
      monotonic: { classification: 'REVERSING', score: 0, regressed: true, reversed: true },
      stability: { bounded: false, overflow: true, recursiveInstability: true, containment: 0 },
      divergence: { severity: 'CRITICAL', recursive: true, crossLayer: true, fragmented: true, radius: 80 },
      readOnlyOk: true,
    });
    expect(cert.rank).toBe('BLOCKED');
    expect(cert.safe).toBe(false);
  });
});

describe('readonly invariants', () => {
  it('flags broken readonly invariant', () => {
    const s = buildConvergenceSpace([
      node('a', [], 0, { liveExecutionEnabled: true }),
    ]);
    const v = assertConvergenceReadonly(s.nodes);
    expect(v.length).toBe(1);
    expect(v[0].code).toBe('CONVERGENCE_READONLY_INVARIANT_BROKEN');
  });

  it('default safe inputs produce zero violations', () => {
    const inputs = buildDefaultConvergenceInputs();
    const env = buildConvergenceEnvelope('default', inputs);
    expect(assertAllConvergenceIntegrity([env])).toEqual([]);
  });
});

describe('determinism', () => {
  it('produces JSON-identical envelopes for identical input', () => {
    const inputs = [
      adaptCanonicalAlgebra({ id: 'a', value: 1, successors: ['b'] }),
      adaptGovernanceMesh({ id: 'b', value: 2 }),
    ];
    const a = buildConvergenceEnvelope('det', inputs);
    const b = buildConvergenceEnvelope('det', inputs);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(assertConvergenceDeterminism(a, b)).toEqual([]);
  });

  it('detects no runtime mutation', () => {
    const inputs = buildDefaultConvergenceInputs();
    const before = buildConvergenceSpace(inputs).nodes;
    buildConvergenceEnvelope('m', inputs);
    const after = buildConvergenceSpace(inputs).nodes;
    expect(assertNoRuntimeMutation(before, after)).toEqual([]);
  });
});

describe('aggregation', () => {
  it('aggregates and ranks risks', () => {
    const safe = buildConvergenceEnvelope('safe', buildDefaultConvergenceInputs());
    const agg = aggregateConvergenceCalculus([safe]);
    expect(agg.stable).toBe(true);
    expect(agg.worstSeverity).toBe('info');
    expect(agg.envelopes.length).toBe(1);
  });

  it('global convergence within [0,1]', () => {
    const env = buildConvergenceEnvelope('g', buildDefaultConvergenceInputs());
    const score = calculateGlobalConvergence([env]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('summarizes health', () => {
    const env = buildConvergenceEnvelope('h', buildDefaultConvergenceInputs());
    const h = summarizeConvergenceHealth([env]);
    expect(h.stable).toBe(true);
    expect(h.avgScore).toBeGreaterThan(0);
  });
});

describe('adapters', () => {
  it('produces inert frozen inputs', () => {
    const i = adaptIsolation({ value: 3 });
    expect(Object.isFrozen(i)).toBe(true);
    expect(i.layer).toBe('isolation');
    expect(i.stage).toBe('STAGE_0_READ_ONLY');
    expect(i.liveExecutionEnabled).toBe(false);
  });
});

describe('explainers', () => {
  it('explains all classes', () => {
    expect(explainConvergence('STABLE')).toContain('stable');
    expect(explainConvergence('DIVERGENT')).toContain('diverge');
    expect(
      explainDivergence({
        severity: 'NONE',
        recursive: false,
        crossLayer: false,
        fragmented: false,
        radius: 0,
      }),
    ).toContain('severity=NONE');
  });
});

describe('integration', () => {
  it('full default envelope produces no integrity violations', () => {
    const env = buildConvergenceEnvelope('full', buildDefaultConvergenceInputs());
    expect(env.classification).toBe('STABLE');
    expect(env.certification.rank).toBe('FULL');
    expect(assertAllConvergenceIntegrity([env])).toEqual([]);
  });
});
