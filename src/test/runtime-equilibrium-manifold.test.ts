import { describe, it, expect } from 'vitest';
import { aggregateManifoldMechanics, assertAllManifoldIntegrity, assertManifoldDeterminism, assertManifoldReadonly, assertNoContinuityCollapse, assertNoInfiniteGeodesics, assertNoIrreversibleDeformation, assertNoTerminalContinuumSingularity, buildDefaultManifoldInputs, buildDeformationContinuum, buildEquilibriumManifold, buildManifoldEnvelope, buildStabilityContinuum, calculateContinuityMetrics, calculateConvergenceContinuity, calculatePropagationGeodesics, calculateTopologicalContinuity, detectContinuousSingularity, explainManifold, explainContinuity, normalizeManifold } from '@/lib/runtimeEquilibriumManifold';
import type { ManifoldNode } from '@/lib/runtimeEquilibriumManifold';

const node = (over: Partial<ManifoldNode> = {}): ManifoldNode => Object.freeze({
  id: 'n1', layer: 'test', stage: 'STAGE_0_READ_ONLY',
  liveExecutionEnabled: false, retryEnabled: false, backgroundEnabled: false, realUsersAllowed: false,
  position: 0, tension: 0, elasticity: 1, neighbors: Object.freeze([]),
  signature: 'n1:test:STAGE_0_READ_ONLY:0:0:1:',
  ...over,
});

describe('runtimeEquilibriumManifold', () => {
  it('builds stable manifold with default inputs', () => {
    const nodes = buildDefaultManifoldInputs();
    const env = buildManifoldEnvelope('e1', nodes);
    expect(env.classification).toBe('STABLE');
    expect(env.stable).toBe(true);
    expect(env.certification.safe).toBe(true);
    expect(assertAllManifoldIntegrity([env])).toEqual([]);
  });

  it('detects infinite geodesics (many unknown neighbors)', () => {
    const nodes = [node({ id: 'a', neighbors: Object.freeze(['g1','g2','g3','g4','g5']) })];
    const g = calculatePropagationGeodesics(nodes);
    expect(g.infinite).toBe(true);
    expect(g.propagation).toBe('INFINITE');
    expect(assertNoInfiniteGeodesics(g).length).toBe(1);
  });

  it('detects continuity collapse on saturated tension', () => {
    const nodes = [node({ id: 'a', tension: 10 }), node({ id: 'b', tension: 10 })];
    const c = calculateTopologicalContinuity(nodes);
    expect(c.class).toBe('COLLAPSED');
    expect(assertNoContinuityCollapse(c).length).toBe(1);
  });

  it('detects elastic recovery', () => {
    const nodes = [node({ id: 'a', tension: 2, elasticity: 3 })];
    const d = buildDeformationContinuum(nodes);
    expect(d.elastic).toBe(true);
    expect(d.irreversible).toBe(false);
  });

  it('detects irreversible deformation', () => {
    const nodes = [node({ id: 'a', tension: 10, elasticity: 0 })];
    const d = buildDeformationContinuum(nodes);
    expect(d.irreversible).toBe(true);
    expect(d.deformation).toBe('IRREVERSIBLE');
    expect(assertNoIrreversibleDeformation(d).length).toBe(1);
  });

  it('detects terminal continuum singularity', () => {
    const nodes = [node({ id: 'a', position: 10, tension: 10 })];
    const s = detectContinuousSingularity(nodes);
    expect(s.terminal).toBe(true);
    expect(s.class).toBe('TERMINAL');
    expect(assertNoTerminalContinuumSingularity(s).length).toBe(1);
  });

  it('detects recursive singularity (self-loop)', () => {
    const nodes = [node({ id: 'a', neighbors: Object.freeze(['a']) })];
    const s = detectContinuousSingularity(nodes);
    expect(s.recursive).toBe(true);
  });

  it('blocks readonly invariant violations', () => {
    const nodes = [node({ id: 'a', liveExecutionEnabled: true })];
    expect(assertManifoldReadonly(nodes).length).toBe(1);
  });

  it('continuity metric flags instability', () => {
    const nodes = [node({ id: 'a', tension: 10 }), node({ id: 'b', tension: 0 })];
    const m = calculateContinuityMetrics(nodes);
    expect(m.stable).toBe(false);
  });

  it('convergence continuity detects discontinuity', () => {
    const nodes = [node({ id: 'a', position: 0 }), node({ id: 'b', position: 20 })];
    const r = calculateConvergenceContinuity(nodes);
    expect(r.discontinuous).toBe(true);
    expect(r.continuous).toBe(false);
  });

  it('normalizes manifold field', () => {
    expect(normalizeManifold([2, -4, 8])).toEqual([0.25, -0.5, 1]);
  });

  it('is deterministic: same input → identical envelope JSON', () => {
    const nodes = buildDefaultManifoldInputs();
    const a = buildManifoldEnvelope('id', nodes);
    const b = buildManifoldEnvelope('id', nodes);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(assertManifoldDeterminism(a.manifold.signature, b.manifold.signature)).toEqual([]);
  });

  it('freezes envelope deeply', () => {
    const env = buildManifoldEnvelope('e', buildDefaultManifoldInputs());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.continuum)).toBe(true);
    expect(Object.isFrozen(env.continuum.nodes)).toBe(true);
    expect(() => { (env as unknown as { x: number }).x = 1; }).toThrow();
  });

  it('aggregation summarizes worst across envelopes', () => {
    const ok = buildManifoldEnvelope('ok', buildDefaultManifoldInputs());
    const bad = buildManifoldEnvelope('bad', [node({ id: 'x', liveExecutionEnabled: true })]);
    const agg = aggregateManifoldMechanics([ok, bad]);
    expect(agg.envelopes.length).toBe(2);
    expect(agg.stable).toBe(false);
    expect(['error', 'critical']).toContain(agg.worstSeverity);
  });

  it('explainers return non-empty strings', () => {
    expect(explainManifold('STABLE')).toMatch(/estável/);
    expect(explainContinuity(calculateTopologicalContinuity([])).length).toBeGreaterThan(0);
  });

  it('certification blocks unsafe stage', () => {
    const env = buildManifoldEnvelope('bad', [node({ id: 'x', stage: 'STAGE_1_PILOT' })]);
    expect(env.certification.rank).toBe('BLOCKED');
    expect(env.certification.safe).toBe(false);
  });

  it('builds continuum with sorted nodes (determinism)', () => {
    const c = buildStabilityContinuum([node({ id: 'b' }), node({ id: 'a' })]);
    expect(c.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('equilibrium manifold flags instability on saturation', () => {
    const m = buildEquilibriumManifold([node({ id: 'x', tension: 10 }), node({ id: 'y' })]);
    expect(m.unstable).toBe(true);
  });

  it('assertAllManifoldIntegrity returns [] for healthy default system', () => {
    const env = buildManifoldEnvelope('h', buildDefaultManifoldInputs());
    expect(assertAllManifoldIntegrity([env])).toEqual([]);
  });
});
