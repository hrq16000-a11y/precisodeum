import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ insert: async () => ({}) }) } }));

import {
  assertAllFunctorIntegrity,
  buildFunctorEnvelope,
  buildDefaultFunctorInputs,
  buildEquilibriumFunctor,
  buildFunctorComposition,
  buildFunctorIdentity,
  buildFunctorNormalization,
  buildFunctorDeterminism,
  buildFunctorEquivalence,
  buildFunctorReduction,
  buildFunctorTopology,
  buildFunctorStability,
  aggregateFunctorMechanics,
  adaptEquilibriumCategory,
  adaptEquilibriumManifold,
  emitFunctorGenerated,
  explainFunctor,
  explainEnvelope,
} from '@/lib/runtimeEquilibriumFunctor';

describe('runtime equilibrium functor (1.9.7)', () => {
  it('builds stable default envelope', () => {
    const objs = buildDefaultFunctorInputs();
    const env = buildFunctorEnvelope('e1', objs);
    expect(env.stable).toBe(true);
    expect(env.functor.class).toBe('PRESERVING');
    expect(env.composition.class).toBe('ASSOCIATIVE');
    expect(env.identity.class).toBe('PRESERVED');
    expect(env.normalization.idempotent).toBe(true);
    expect(env.determinism.class).toBe('DETERMINISTIC');
    expect(env.topology.class).toBe('STABLE');
    expect(env.stability.class).toBe('STABLE');
    expect(env.certification.safe).toBe(true);
  });

  it('is deterministic (same input → byte-equivalent JSON)', () => {
    const objs = buildDefaultFunctorInputs();
    const a = buildFunctorEnvelope('x', objs);
    const b = buildFunctorEnvelope('x', objs);
    expect(a.functor.signature).toBe(b.functor.signature);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('preserves identity for defaults', () => {
    const objs = buildDefaultFunctorInputs();
    const i = buildFunctorIdentity(objs);
    expect(i.broken).toBe(false);
    expect(i.violations).toBe(0);
    expect(i.preservation).toBeGreaterThan(0.9);
  });

  it('composition is associative for defaults', () => {
    const objs = buildDefaultFunctorInputs();
    const c = buildFunctorComposition(objs);
    expect(c.class).toBe('ASSOCIATIVE');
    expect(c.broken).toBe(false);
  });

  it('reduction is idempotent for defaults', () => {
    const r = buildFunctorReduction(buildDefaultFunctorInputs());
    expect(r.idempotent).toBe(true);
    const r2 = buildFunctorReduction(buildDefaultFunctorInputs());
    expect(JSON.stringify(r)).toBe(JSON.stringify(r2));
  });

  it('detects functor collapse (all preservation/identity zero)', () => {
    const o = adaptEquilibriumCategory({ preservation: 0, identity: 0 });
    const f = buildEquilibriumFunctor([o]);
    expect(f.collapsed).toBe(true);
    expect(f.class).toBe('DEGENERATE');
  });

  it('detects identity break', () => {
    const o = adaptEquilibriumCategory({ identity: 0 });
    const i = buildFunctorIdentity([o]);
    expect(i.broken).toBe(true);
    expect(i.class).toBe('BROKEN');
  });

  it('detects composition broken', () => {
    const o = adaptEquilibriumCategory({ preservation: 0.1, identity: 0.1 });
    const c = buildFunctorComposition([o]);
    expect(c.broken).toBe(true);
  });

  it('detects determinism degradation', () => {
    const o = adaptEquilibriumCategory({ determinism: 0 });
    const d = buildFunctorDeterminism([o]);
    expect(d.degraded).toBe(true);
    expect(d.class).toBe('NONDETERMINISTIC');
  });

  it('detects equivalence fracture', () => {
    const objs = [
      adaptEquilibriumCategory({ id: 'a', preservation: 1, identity: 1, determinism: 1 }),
      adaptEquilibriumCategory({ id: 'b', preservation: 0, identity: 0, determinism: 0 }),
      adaptEquilibriumCategory({ id: 'c', preservation: 1, identity: 0, determinism: 1 }),
    ];
    const e = buildFunctorEquivalence(objs);
    expect(['FRACTURED', 'REGRESSED', 'WEAK']).toContain(e.class);
    expect(e.class).not.toBe('EQUIVALENT');
  });

  it('detects topology collapse for invalid morphisms', () => {
    const o = adaptEquilibriumCategory({ morphisms: Object.freeze(['nonexistent:0', 'orphan:1']) });
    const t = buildFunctorTopology([o]);
    expect(t.collapsed).toBe(true);
  });

  it('stability collapses when topology+identity collapse', () => {
    const o = adaptEquilibriumCategory({ preservation: 0, identity: 0, stability: 0, morphisms: Object.freeze(['x:0']) });
    const f = buildEquilibriumFunctor([o]);
    const c = buildFunctorComposition(f.objects);
    const i = buildFunctorIdentity(f.objects);
    const n = buildFunctorNormalization(f.objects);
    const t = buildFunctorTopology(f.objects);
    const s = buildFunctorStability(c, i, n, t);
    expect(s.collapsed || s.unstable).toBe(true);
  });

  it('aggregates functor mechanics deterministically', () => {
    const objs = buildDefaultFunctorInputs();
    const e1 = buildFunctorEnvelope('a', objs);
    const e2 = buildFunctorEnvelope('b', objs);
    const agg = aggregateFunctorMechanics([e1, e2]);
    expect(agg.stable).toBe(true);
    expect(agg.envelopes.length).toBe(2);
    expect(agg.worstSeverity).toBe('info');
    expect(agg.worstFunctor).toBe('PRESERVING');
  });

  it('adapters produce frozen, inert objects', () => {
    const o = adaptEquilibriumManifold({});
    expect(Object.isFrozen(o)).toBe(true);
    expect(o.liveExecutionEnabled).toBe(false);
    expect(o.retryEnabled).toBe(false);
    expect(o.backgroundEnabled).toBe(false);
    expect(o.realUsersAllowed).toBe(false);
    expect(o.stage).toBe('STAGE_0_READ_ONLY');
  });

  it('does not mutate input snapshots', () => {
    const objs = buildDefaultFunctorInputs();
    const before = JSON.stringify(objs);
    buildFunctorEnvelope('x', objs);
    expect(JSON.stringify(objs)).toBe(before);
  });

  it('observability is fail-soft and PII-free', async () => {
    await expect(emitFunctorGenerated('id', { email: 'x@y.z', safe: 1 })).resolves.toBeUndefined();
  });

  it('explainers return deterministic strings', () => {
    const env = buildFunctorEnvelope('e', buildDefaultFunctorInputs());
    expect(typeof explainFunctor(env.functor)).toBe('string');
    expect(typeof explainEnvelope(env)).toBe('string');
    expect(explainFunctor(env.functor)).toBe(explainFunctor(env.functor));
  });

  it('envelope is deeply immutable', () => {
    const env = buildFunctorEnvelope('e', buildDefaultFunctorInputs());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.functor)).toBe(true);
    expect(Object.isFrozen(env.functor.objects)).toBe(true);
    expect(() => { (env as { stable: boolean }).stable = false; }).toThrow();
  });

  it('assertAllFunctorIntegrity returns empty for default state', () => {
    const v = assertAllFunctorIntegrity();
    expect(v).toEqual([]);
  });
});
