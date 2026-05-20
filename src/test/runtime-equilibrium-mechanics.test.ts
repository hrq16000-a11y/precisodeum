/**
 * Fase 1.9.3 — Runtime Equilibrium Mechanics tests.
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateEquilibriumMechanics,
  assertAllEquilibriumIntegrity,
  assertEquilibriumDeterminism,
  assertEquilibriumReadonly,
  assertNoEntropyExplosion,
  assertNoUnboundedPropagation,
  assertNoTopologyCollapse,
  buildDefaultEquilibriumInputs,
  buildEquilibriumEnvelope,
  buildStabilityField,
  buildTopologyTension,
  calculateDissipation,
  calculatePropagationEnergy,
  calculateRuntimeEntropy,
  explainEquilibrium,
  explainEntropy,
} from '@/lib/runtimeEquilibriumMechanics';
import type { EquilibriumNode } from '@/lib/runtimeEquilibriumMechanics';

const node = (over: Partial<EquilibriumNode> = {}): EquilibriumNode => Object.freeze({
  id: 'n1', layer: 'test', stage: 'STAGE_0_READ_ONLY',
  liveExecutionEnabled: false, retryEnabled: false, backgroundEnabled: false, realUsersAllowed: false,
  potential: 0, tension: 0, neighbors: Object.freeze([]),
  signature: 'n1:test:STAGE_0_READ_ONLY:0:0:',
  ...over,
});

describe('runtimeEquilibriumMechanics', () => {
  it('builds stable equilibrium with default inputs', () => {
    const nodes = buildDefaultEquilibriumInputs();
    const env = buildEquilibriumEnvelope('e1', nodes);
    expect(env.classification).toBe('STABLE');
    expect(env.stable).toBe(true);
    expect(env.certification.safe).toBe(true);
    expect(assertAllEquilibriumIntegrity([env])).toEqual([]);
  });

  it('detects fractured topology (disconnected components)', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b' })];
    const topo = buildTopologyTension(nodes);
    expect(topo.fractured).toBe(true);
  });

  it('detects unbounded propagation (unknown neighbor)', () => {
    const nodes = [node({ id: 'a', neighbors: Object.freeze(['ghost']) })];
    const p = calculatePropagationEnergy(nodes);
    expect(p.unbounded).toBe(true);
    expect(assertNoUnboundedPropagation(p).length).toBe(1);
  });

  it('classifies high entropy with skewed distribution', () => {
    const nodes = [node({ id: 'a', tension: 9, potential: 9 }), node({ id: 'b' })];
    const e = calculateRuntimeEntropy(nodes);
    expect(['MEDIUM', 'HIGH', 'CRITICAL', 'LOW']).toContain(e.level);
  });

  it('flags collapsed field and topology', () => {
    const nodes: EquilibriumNode[] = [
      node({ id: 'a', tension: 10, potential: -10 }),
      node({ id: 'b', tension: 10, potential: -10 }),
    ];
    const f = buildStabilityField(nodes);
    expect(f.collapsed).toBe(true);
    const t = buildTopologyTension(nodes);
    expect(t.collapsing).toBe(true);
    expect(assertNoTopologyCollapse(t).length).toBe(1);
  });

  it('blocks readonly invariant violations', () => {
    const nodes = [node({ id: 'a', liveExecutionEnabled: true })];
    expect(assertEquilibriumReadonly(nodes).length).toBe(1);
  });

  it('detects entropy explosion when escalating + critical', () => {
    const env = { level: 'CRITICAL', score: 0.99, escalating: true, collapsed: false, distribution: Object.freeze([0.9, 0.05, 0.05]) } as const;
    expect(assertNoEntropyExplosion(env).length).toBe(1);
  });

  it('dissipation classifies recursive amplification', () => {
    const e = { level: 'HIGH', score: 0.8, escalating: true, collapsed: false, distribution: Object.freeze([0.8, 0.2]) } as const;
    const p = { energy: 'ESCALATING', amplitude: 0.6, containment: 0.3, amplified: true, unbounded: false } as const;
    const d = calculateDissipation(e, p);
    expect(d.recursive).toBe(true);
    expect(d.classification).toBe('RECURSIVE');
  });

  it('is deterministic: same input → identical envelope JSON', () => {
    const nodes = buildDefaultEquilibriumInputs();
    const a = buildEquilibriumEnvelope('id', nodes);
    const b = buildEquilibriumEnvelope('id', nodes);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(assertEquilibriumDeterminism(a.field.signature, b.field.signature)).toEqual([]);
  });

  it('freezes envelope and field deeply', () => {
    const env = buildEquilibriumEnvelope('e', buildDefaultEquilibriumInputs());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.field)).toBe(true);
    expect(Object.isFrozen(env.field.nodes)).toBe(true);
    expect(() => { (env as unknown as { x: number }).x = 1; }).toThrow();
  });

  it('aggregation summarizes worst risk across envelopes', () => {
    const ok = buildEquilibriumEnvelope('ok', buildDefaultEquilibriumInputs());
    const bad = buildEquilibriumEnvelope('bad', [node({ id: 'x', liveExecutionEnabled: true })]);
    const agg = aggregateEquilibriumMechanics([ok, bad]);
    expect(agg.envelopes.length).toBe(2);
    expect(agg.stable).toBe(false);
    expect(['error', 'critical']).toContain(agg.worstSeverity);
  });

  it('explainers return non-empty strings', () => {
    expect(explainEquilibrium('STABLE')).toMatch(/estável/);
    expect(explainEntropy({ level: 'LOW', score: 0.1, escalating: false, collapsed: false, distribution: Object.freeze([]) }).length).toBeGreaterThan(0);
  });

  it('certification blocks when nodes unsafe', () => {
    const env = buildEquilibriumEnvelope('bad', [node({ id: 'x', stage: 'STAGE_1_PILOT' })]);
    expect(env.certification.rank).toBe('BLOCKED');
    expect(env.certification.safe).toBe(false);
  });

  it('assertAllEquilibriumIntegrity returns [] for healthy default system', () => {
    const env = buildEquilibriumEnvelope('h', buildDefaultEquilibriumInputs());
    expect(assertAllEquilibriumIntegrity([env])).toEqual([]);
  });
});
