import { describe, it, expect } from 'vitest';
import { aggregateTensorMechanics, assertAllTensorIntegrity, assertNoCriticalDensity, assertNoTerminalSingularity, assertNoTopologyCollapse, assertNoUnboundedCurvature, assertTensorDeterminism, assertTensorReadonly, buildContainmentField, buildDefaultTensorInputs, buildEquilibriumTensor, buildStabilityGeometry, buildTensorEnvelope, buildTopologyDeformation, calculateConvergenceGradient, calculateInstabilityDensity, calculatePropagationCurvature, detectRuntimeSingularity, explainCurvature, explainTensorState, normalizeTensorField } from '@/lib/runtimeEquilibriumTensor';
import type { TensorNode } from '@/lib/runtimeEquilibriumTensor';

const node = (over: Partial<TensorNode> = {}): TensorNode => Object.freeze({
  id: 'n1', layer: 'test', stage: 'STAGE_0_READ_ONLY',
  liveExecutionEnabled: false, retryEnabled: false, backgroundEnabled: false, realUsersAllowed: false,
  pressure: 0, curvature: 0, density: 0, neighbors: Object.freeze([]),
  signature: 'n1:test:STAGE_0_READ_ONLY:0:0:0:',
  ...over,
});

describe('runtimeEquilibriumTensor', () => {
  it('builds stable tensor with default inputs', () => {
    const nodes = buildDefaultTensorInputs();
    const env = buildTensorEnvelope('e1', nodes);
    expect(env.classification).toBe('STABLE');
    expect(env.stable).toBe(true);
    expect(env.certification.safe).toBe(true);
    expect(assertAllTensorIntegrity([env])).toEqual([]);
  });

  it('detects unbounded curvature', () => {
    const nodes = [node({ id: 'a', curvature: 12 })];
    const c = calculatePropagationCurvature(nodes);
    expect(c.unbounded).toBe(true);
    expect(c.class).toBe('UNBOUNDED');
    expect(assertNoUnboundedCurvature(c).length).toBe(1);
  });

  it('detects critical density', () => {
    const nodes = [node({ id: 'a', density: 10 }), node({ id: 'b', density: 9 })];
    const d = calculateInstabilityDensity(nodes);
    expect(d.level).toBe('CRITICAL');
    expect(assertNoCriticalDensity(d).length).toBe(1);
  });

  it('detects topology fracture and collapse', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b' })];
    const t = buildTopologyDeformation(nodes);
    expect(t.fractured).toBe(false);
    const c = buildTopologyDeformation([node({ id: 'x', pressure: 10, curvature: 10 }), node({ id: 'y', pressure: 10, curvature: 10 })]);
    expect(c.collapsing).toBe(true);
    expect(assertNoTopologyCollapse(c).length).toBe(1);
  });

  it('detects terminal singularity', () => {
    const nodes = [node({ id: 'a', pressure: 10, curvature: 10, density: 10 })];
    const s = detectRuntimeSingularity(nodes);
    expect(s.terminal).toBe(true);
    expect(s.class).toBe('TERMINAL');
    expect(assertNoTerminalSingularity(s).length).toBe(1);
  });

  it('detects recursive singularity (self-loop)', () => {
    const nodes = [node({ id: 'a', neighbors: Object.freeze(['a']) })];
    const s = detectRuntimeSingularity(nodes);
    expect(s.recursive).toBe(true);
  });

  it('blocks readonly invariant violations', () => {
    const nodes = [node({ id: 'a', liveExecutionEnabled: true })];
    expect(assertTensorReadonly(nodes).length).toBe(1);
  });

  it('detects containment leak (unknown neighbor)', () => {
    const nodes = [node({ id: 'a', neighbors: Object.freeze(['ghost']) })];
    const c = buildContainmentField(nodes);
    expect(c.leaking).toBe(true);
  });

  it('normalizes tensor field', () => {
    const out = normalizeTensorField([2, 4, -8]);
    expect(out).toEqual([0.25, 0.5, -1]);
  });

  it('convergence gradient detects reversed flow', () => {
    const nodes = [node({ id: 'a', pressure: 5 }), node({ id: 'b', pressure: 3 }), node({ id: 'c', pressure: 1 })];
    const g = calculateConvergenceGradient(nodes);
    expect(g.reversed).toBe(true);
  });

  it('is deterministic: same input → identical envelope JSON', () => {
    const nodes = buildDefaultTensorInputs();
    const a = buildTensorEnvelope('id', nodes);
    const b = buildTensorEnvelope('id', nodes);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(assertTensorDeterminism(a.tensor.signature, b.tensor.signature)).toEqual([]);
  });

  it('freezes envelope deeply', () => {
    const env = buildTensorEnvelope('e', buildDefaultTensorInputs());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.geometry)).toBe(true);
    expect(Object.isFrozen(env.geometry.nodes)).toBe(true);
    expect(() => { (env as unknown as { x: number }).x = 1; }).toThrow();
  });

  it('aggregation summarizes worst across envelopes', () => {
    const ok = buildTensorEnvelope('ok', buildDefaultTensorInputs());
    const bad = buildTensorEnvelope('bad', [node({ id: 'x', liveExecutionEnabled: true })]);
    const agg = aggregateTensorMechanics([ok, bad]);
    expect(agg.envelopes.length).toBe(2);
    expect(agg.stable).toBe(false);
    expect(['error', 'critical']).toContain(agg.worstSeverity);
  });

  it('explainers return non-empty strings', () => {
    expect(explainTensorState('STABLE')).toMatch(/estável/);
    expect(explainCurvature(calculatePropagationCurvature([])).length).toBeGreaterThan(0);
  });

  it('certification blocks unsafe stage', () => {
    const env = buildTensorEnvelope('bad', [node({ id: 'x', stage: 'STAGE_1_PILOT' })]);
    expect(env.certification.rank).toBe('BLOCKED');
    expect(env.certification.safe).toBe(false);
  });

  it('builds geometry with sorted nodes (determinism)', () => {
    const a = buildStabilityGeometry([node({ id: 'b' }), node({ id: 'a' })]);
    expect(a.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('equilibrium tensor flags instability when normalized field saturates', () => {
    const t = buildEquilibriumTensor([node({ id: 'x', pressure: 10 }), node({ id: 'y', pressure: 0 })]);
    expect(t.unstable).toBe(true);
  });

  it('assertAllTensorIntegrity returns [] for healthy default system', () => {
    const env = buildTensorEnvelope('h', buildDefaultTensorInputs());
    expect(assertAllTensorIntegrity([env])).toEqual([]);
  });
});
