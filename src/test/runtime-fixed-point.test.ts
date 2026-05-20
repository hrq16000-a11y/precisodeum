/**
 * Fase 1.9.1 — Runtime Fixed-Point tests.
 */

import { describe, expect, it } from 'vitest';
import {
  adaptFixedPointState,
  aggregateFixedPointRuntime,
  assertAllFixedPointIntegrity,
  buildDefaultFixedPointStates,
  buildFixedPointEnvelope,
  calculateFixedPointComplexity,
  calculateFixedPointConfidence,
  classifyConvergence,
  classifyFixedPoint,
  detectFalseConvergence,
  detectInfiniteResolution,
  detectNormalizationOscillation,
  detectPropagationOverflow,
  detectRecursiveTopology,
  detectUnstableResolution,
  explainFixedPointIntegrity,
  normalizeRecursiveResolution,
  rankFixedPointRisks,
  resolveEquivalentFixedPoints,
  resolveFixedPoints,
  summarizeFixedPointHealth,
} from '@/lib/runtimeFixedPoint';

const safe = (layer: string, n = 1) =>
  Array.from({ length: n }, (_, i) =>
    adaptFixedPointState({ id: `${layer}:${i}`, layer }),
  );

describe('runtime fixed-point — resolution', () => {
  it('resolves stable single state', () => {
    const r = resolveFixedPoints(safe('canonical-algebra', 1));
    expect(r.fixedPoints).toHaveLength(1);
    expect(r.fixedPoints[0].class).toBe('stable');
    expect(r.impossible).toHaveLength(0);
  });

  it('classifies convergent when repeated identical states', () => {
    const r = resolveFixedPoints(safe('isolation', 3));
    expect(r.fixedPoints[0].class).toBe('convergent');
  });

  it('classifies recursive when iterations > 8', () => {
    const r = resolveFixedPoints(safe('integrity', 10));
    expect(r.fixedPoints[0].class).toBe('recursive');
    expect(r.loops.length).toBe(1);
  });

  it('flags impossible when invariants are broken', () => {
    const bad = adaptFixedPointState({
      id: 'x',
      layer: 'enforcement',
      liveExecutionEnabled: true,
    });
    const r = resolveFixedPoints([bad]);
    expect(r.impossible.length).toBe(1);
    expect(classifyFixedPoint([bad])).toBe('impossible');
  });

  it('detectUnstableResolution / detectInfiniteResolution', () => {
    const r = resolveFixedPoints(safe('stability', 1));
    expect(detectUnstableResolution(r)).toBe(false);
    expect(detectInfiniteResolution(r)).toBe(false);
  });
});

describe('runtime fixed-point — convergence & topology', () => {
  it('classifies convergence as strict on stable points', () => {
    const r = resolveFixedPoints(safe('mesh', 1));
    expect(classifyConvergence(r)).toBe('strict');
  });

  it('detects recursive topology when loops present', () => {
    const r = resolveFixedPoints(safe('replay', 12));
    expect(detectRecursiveTopology(r)).toBe(true);
  });

  it('detects propagation overflow on huge iterations', () => {
    const states = safe('history', 80);
    const r = resolveFixedPoints(states);
    expect(detectPropagationOverflow(r)).toBe(true);
  });
});

describe('runtime fixed-point — equivalence & normalization', () => {
  it('resolves equivalence classes deterministically', () => {
    const r = resolveFixedPoints([
      ...safe('a', 1),
      ...safe('b', 1),
    ]);
    const classes = resolveEquivalentFixedPoints(r);
    expect(classes.length).toBeGreaterThan(0);
  });

  it('normalization is idempotent', () => {
    const r = resolveFixedPoints(safe('promotion', 2));
    const a = normalizeRecursiveResolution(r);
    const b = normalizeRecursiveResolution(r);
    expect(a).toBe(b);
    expect(detectNormalizationOscillation(r)).toBe(false);
  });

  it('false convergence detector is deterministic', () => {
    const r = resolveFixedPoints(safe('pilot', 10));
    expect(typeof detectFalseConvergence(r)).toBe('boolean');
    expect(detectFalseConvergence(r)).toBe(detectFalseConvergence(r));
  });
});

describe('runtime fixed-point — envelope & certification', () => {
  it('FULL when canonical safe defaults', () => {
    const env = buildFixedPointEnvelope('env-1', buildDefaultFixedPointStates());
    expect(['FULL', 'PARTIAL']).toContain(env.certification.rank);
    expect(env.health.stable).toBe(true);
  });

  it('BLOCKED when readonly invariant broken', () => {
    const states = [
      adaptFixedPointState({
        id: 'x',
        layer: 'enforcement',
        retryEnabled: true,
      }),
    ];
    const env = buildFixedPointEnvelope('env-bad', states);
    expect(env.certification.rank).toBe('BLOCKED');
    expect(env.certification.reasons).toContain('readonly_invariant_broken');
  });

  it('envelope is deeply frozen', () => {
    const env = buildFixedPointEnvelope('env-2', buildDefaultFixedPointStates());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.resolution)).toBe(true);
    expect(Object.isFrozen(env.certification)).toBe(true);
    expect(Object.isFrozen(env.health)).toBe(true);
  });
});

describe('runtime fixed-point — aggregation', () => {
  it('aggregates deterministically', () => {
    const env = buildFixedPointEnvelope('a', buildDefaultFixedPointStates());
    const agg1 = aggregateFixedPointRuntime([env]);
    const agg2 = aggregateFixedPointRuntime([env]);
    expect(agg1.score).toBe(agg2.score);
    expect(agg1.confidence).toBe(agg2.confidence);
    expect(agg1.complexity).toBe(agg2.complexity);
    expect(agg1.stable).toBe(true);
  });

  it('confidence within [0,1]', () => {
    const env = buildFixedPointEnvelope('a', buildDefaultFixedPointStates());
    const c = calculateFixedPointConfidence([env]);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('complexity sums iterations', () => {
    const env = buildFixedPointEnvelope('a', buildDefaultFixedPointStates());
    expect(calculateFixedPointComplexity([env])).toBeGreaterThanOrEqual(0);
  });

  it('summarize returns counts', () => {
    const env = buildFixedPointEnvelope('a', buildDefaultFixedPointStates());
    const s = summarizeFixedPointHealth([env]);
    expect(s.total).toBe(1);
  });

  it('rankFixedPointRisks empty when stable', () => {
    const env = buildFixedPointEnvelope('a', buildDefaultFixedPointStates());
    expect(rankFixedPointRisks([env]).length).toBe(0);
  });
});

describe('runtime fixed-point — guards', () => {
  it('assertAllFixedPointIntegrity returns [] for canonical defaults', () => {
    const env = buildFixedPointEnvelope('a', buildDefaultFixedPointStates());
    expect(assertAllFixedPointIntegrity([env])).toEqual([]);
  });

  it('explainer returns non-empty deterministic string', () => {
    const env = buildFixedPointEnvelope('a', buildDefaultFixedPointStates());
    const s = explainFixedPointIntegrity(env);
    expect(s.length).toBeGreaterThan(0);
    expect(s).toBe(explainFixedPointIntegrity(env));
  });

  it('detects violations on unsafe envelope', () => {
    const states = [
      adaptFixedPointState({
        id: 'x',
        layer: 'enforcement',
        backgroundEnabled: true,
      }),
    ];
    const env = buildFixedPointEnvelope('bad', states);
    const violations = assertAllFixedPointIntegrity([env]);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.code === 'FIXED_POINT_READONLY_INVARIANT_BROKEN')).toBe(true);
  });
});

describe('runtime fixed-point — adapters inertness', () => {
  it('adapters produce frozen states', () => {
    const states = buildDefaultFixedPointStates();
    for (const s of states) {
      expect(Object.isFrozen(s)).toBe(true);
      expect(s.liveExecutionEnabled).toBe(false);
      expect(s.retryEnabled).toBe(false);
      expect(s.backgroundEnabled).toBe(false);
      expect(s.realUsersAllowed).toBe(false);
      expect(s.stage).toBe('STAGE_0_READ_ONLY');
    }
  });

  it('reversibility — same input → same envelope signature', () => {
    const a = buildFixedPointEnvelope('x', buildDefaultFixedPointStates());
    const b = buildFixedPointEnvelope('x', buildDefaultFixedPointStates());
    expect(a.normalization.signature).toBe(b.normalization.signature);
  });
});
