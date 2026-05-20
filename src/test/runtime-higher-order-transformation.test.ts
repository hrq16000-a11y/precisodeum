import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ insert: async () => ({}) }) } }));

import {
  assertAllHigherOrderIntegrity,
  buildHigherOrderEnvelope,
  buildDefaultHigherOrderInputs,
  buildHigherOrderTransformation,
  buildHigherOrderComposition,
  buildHigherOrderIdentity,
  buildHigherOrderNormalization,
  buildHigherOrderDeterminism,
  buildHigherOrderEquivalence,
  buildHigherOrderReduction,
  buildHigherOrderTopology,
  buildHigherOrderStability,
  buildHigherOrderNaturality,
  buildHigherOrderFunctoriality,
  buildTransformationLifting,
  aggregateHigherOrderMechanics,
  adaptNaturalTransformation,
  adaptEquilibriumFunctor,
  emitHigherOrderGenerated,
  explainHigherOrderTransformation,
  explainHigherOrderEnvelope,
  explainHigherOrderNaturality,
} from '@/lib/runtimeHigherOrderTransformation';

describe('runtime higher-order transformation (1.9.9)', () => {
  it('builds stable default envelope', () => {
    const comps = buildDefaultHigherOrderInputs();
    const env = buildHigherOrderEnvelope('e1', comps);
    expect(env.stable).toBe(true);
    expect(env.transformation.class).toBe('HIGHER_ORDER');
    expect(env.composition.class).toBe('ASSOCIATIVE');
    expect(env.identity.class).toBe('PRESERVED');
    expect(env.normalization.idempotent).toBe(true);
    expect(env.determinism.class).toBe('DETERMINISTIC');
    expect(env.topology.class).toBe('STABLE');
    expect(env.stability.class).toBe('STABLE');
    expect(env.naturality.class).toBe('NATURAL');
    expect(env.functoriality.class).toBe('FUNCTORIAL');
    expect(env.lifting.class).toBe('LIFTED');
    expect(env.certification.safe).toBe(true);
  });

  it('is deterministic (byte-equivalent JSON)', () => {
    const comps = buildDefaultHigherOrderInputs();
    const a = buildHigherOrderEnvelope('x', comps);
    const b = buildHigherOrderEnvelope('x', comps);
    expect(a.transformation.signature).toBe(b.transformation.signature);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('lifting is idempotent/deterministic', () => {
    const comps = buildDefaultHigherOrderInputs();
    const l1 = buildTransformationLifting(comps);
    const l2 = buildTransformationLifting(comps);
    expect(JSON.stringify(l1)).toBe(JSON.stringify(l2));
    expect(l1.unliftable).toBe(false);
  });

  it('preserves functoriality for defaults', () => {
    const f = buildHigherOrderFunctoriality(buildDefaultHigherOrderInputs());
    expect(f.failed).toBe(false);
    expect(f.class).toBe('FUNCTORIAL');
  });

  it('preserves naturality for defaults', () => {
    const n = buildHigherOrderNaturality(buildDefaultHigherOrderInputs());
    expect(n.broken).toBe(false);
    expect(n.class).toBe('NATURAL');
  });

  it('composition is associative for defaults', () => {
    const c = buildHigherOrderComposition(buildDefaultHigherOrderInputs());
    expect(c.class).toBe('ASSOCIATIVE');
    expect(c.broken).toBe(false);
  });

  it('reduction is idempotent', () => {
    const r = buildHigherOrderReduction(buildDefaultHigherOrderInputs());
    expect(r.idempotent).toBe(true);
  });

  it('detects higher-order collapse', () => {
    const c = adaptNaturalTransformation({ naturality: 0, functoriality: 0, lift: 0 });
    const t = buildHigherOrderTransformation([c]);
    expect(t.collapsed).toBe(true);
    expect(t.class).toBe('DEGENERATE');
  });

  it('detects naturality break', () => {
    const c = adaptNaturalTransformation({ naturality: 0 });
    const n = buildHigherOrderNaturality([c]);
    expect(n.broken).toBe(true);
  });

  it('detects functoriality failure', () => {
    const c = adaptNaturalTransformation({ functoriality: 0 });
    const f = buildHigherOrderFunctoriality([c]);
    expect(f.failed).toBe(true);
  });

  it('detects unliftable transformation', () => {
    const c = adaptNaturalTransformation({ lift: 0 });
    const l = buildTransformationLifting([c]);
    expect(l.unliftable).toBe(true);
  });

  it('detects identity break', () => {
    const c = adaptNaturalTransformation({ identity: 0 });
    const i = buildHigherOrderIdentity([c]);
    expect(i.broken).toBe(true);
  });

  it('detects determinism degradation', () => {
    const c = adaptNaturalTransformation({ determinism: 0 });
    const d = buildHigherOrderDeterminism([c]);
    expect(d.degraded).toBe(true);
  });

  it('detects equivalence regression/fracture', () => {
    const comps = [
      adaptNaturalTransformation({ id: 'a', naturality: 1, functoriality: 1, identity: 1, determinism: 1, lift: 1 }),
      adaptNaturalTransformation({ id: 'b', naturality: 0, functoriality: 0, identity: 0, determinism: 0, lift: 0 }),
      adaptNaturalTransformation({ id: 'c', naturality: 1, functoriality: 0, identity: 1, determinism: 0, lift: 1 }),
    ];
    const e = buildHigherOrderEquivalence(comps);
    expect(['FRACTURED', 'REGRESSED', 'WEAK']).toContain(e.class);
  });

  it('detects topology collapse with orphan morphisms', () => {
    const c = adaptNaturalTransformation({ morphisms: Object.freeze(['orphan:x', 'orphan:y']) });
    const t = buildHigherOrderTopology([c]);
    expect(t.collapsed).toBe(true);
  });

  it('stability collapses on fully degenerate inputs', () => {
    const c = adaptNaturalTransformation({ naturality: 0, functoriality: 0, identity: 0, stability: 0, lift: 0, morphisms: Object.freeze(['x:0']) });
    const t = buildHigherOrderTransformation([c]);
    const comp = buildHigherOrderComposition(t.components);
    const i = buildHigherOrderIdentity(t.components);
    const n = buildHigherOrderNormalization(t.components);
    const top = buildHigherOrderTopology(t.components);
    const s = buildHigherOrderStability(comp, i, n, top);
    expect(s.collapsed || s.unstable).toBe(true);
  });

  it('aggregates deterministically', () => {
    const comps = buildDefaultHigherOrderInputs();
    const e1 = buildHigherOrderEnvelope('a', comps);
    const e2 = buildHigherOrderEnvelope('b', comps);
    const agg = aggregateHigherOrderMechanics([e1, e2]);
    expect(agg.stable).toBe(true);
    expect(agg.envelopes.length).toBe(2);
    expect(agg.worstSeverity).toBe('info');
    expect(agg.worstHigherOrder).toBe('HIGHER_ORDER');
    expect(agg.worstFunctoriality).toBe('FUNCTORIAL');
    expect(agg.worstLifting).toBe('LIFTED');
  });

  it('adapters produce frozen, inert objects', () => {
    const c = adaptEquilibriumFunctor({});
    expect(Object.isFrozen(c)).toBe(true);
    expect(c.liveExecutionEnabled).toBe(false);
    expect(c.retryEnabled).toBe(false);
    expect(c.backgroundEnabled).toBe(false);
    expect(c.realUsersAllowed).toBe(false);
    expect(c.stage).toBe('STAGE_0_READ_ONLY');
  });

  it('does not mutate input snapshots', () => {
    const comps = buildDefaultHigherOrderInputs();
    const before = JSON.stringify(comps);
    buildHigherOrderEnvelope('x', comps);
    expect(JSON.stringify(comps)).toBe(before);
  });

  it('observability is fail-soft and PII-free', async () => {
    await expect(emitHigherOrderGenerated('id', { email: 'x@y.z', safe: 1 })).resolves.toBeUndefined();
  });

  it('explainers return deterministic strings', () => {
    const env = buildHigherOrderEnvelope('e', buildDefaultHigherOrderInputs());
    expect(typeof explainHigherOrderTransformation(env.transformation)).toBe('string');
    expect(typeof explainHigherOrderEnvelope(env)).toBe('string');
    expect(typeof explainHigherOrderNaturality(env.naturality)).toBe('string');
    expect(explainHigherOrderTransformation(env.transformation)).toBe(explainHigherOrderTransformation(env.transformation));
  });

  it('envelope is deeply immutable', () => {
    const env = buildHigherOrderEnvelope('e', buildDefaultHigherOrderInputs());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.transformation)).toBe(true);
    expect(Object.isFrozen(env.transformation.components)).toBe(true);
    expect(() => { (env as { stable: boolean }).stable = false; }).toThrow();
  });

  it('assertAllHigherOrderIntegrity returns empty for default state', () => {
    const v = assertAllHigherOrderIntegrity();
    expect(v).toEqual([]);
  });
});
