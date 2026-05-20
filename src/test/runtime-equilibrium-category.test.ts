import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ insert: async () => ({}) }) } }));

import {
  assertAllCategoryIntegrity,
  buildCategoryEnvelope,
  buildDefaultCategoryInputs,
  buildStabilityCategory,
  buildRuntimeFunctor,
  buildNaturalTransformation,
  buildPropagationMorphisms,
  composeRuntimeMorphisms,
  buildIdentityMorphisms,
  calculateEquivalenceRelations,
  buildCoherenceConstraints,
  detectFunctorialCollapse,
  aggregateCategoryMechanics,
  adaptEquilibriumManifold,
  adaptEquilibriumTensor,
  emitCategoryGenerated,
  explainCategory,
  explainFunctor,
} from '@/lib/runtimeEquilibriumCategory';

describe('runtime equilibrium category (1.9.6)', () => {
  it('builds stable default envelope', () => {
    const objs = buildDefaultCategoryInputs();
    const env = buildCategoryEnvelope('e1', objs);
    expect(env.stable).toBe(true);
    expect(env.category.classification === 'IDENTITY' || env.category.classification === 'STABLE').toBe(true);
    expect(env.functor.class).toBe('PRESERVING');
    expect(env.transformation.class).toBe('NATURAL');
    expect(env.morphisms.infinite).toBe(false);
    expect(env.coherence.collapsing).toBe(false);
    expect(env.collapse.irrecoverable).toBe(false);
    expect(env.certification.safe).toBe(true);
  });

  it('is deterministic (same input → same signatures)', () => {
    const objs = buildDefaultCategoryInputs();
    const a = buildCategoryEnvelope('x', objs);
    const b = buildCategoryEnvelope('x', objs);
    expect(a.category.signature).toBe(b.category.signature);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('detects infinite morphisms', () => {
    const morph = Array.from({ length: 40 }, (_, i) => `n:${i}`);
    const o = adaptEquilibriumManifold({ morphisms: Object.freeze(morph) });
    const m = buildPropagationMorphisms([o]);
    expect(m.infinite).toBe(true);
    expect(m.propagation).toBe('INFINITE');
  });

  it('detects functor degeneration', () => {
    const o = adaptEquilibriumTensor({ preservation: 0 });
    const f = buildRuntimeFunctor([o]);
    expect(f.degenerate).toBe(true);
    expect(f.class).toBe('DEGENERATE');
  });

  it('detects broken transformation', () => {
    const o = adaptEquilibriumTensor({ preservation: 0, coherence: 0 });
    const t = buildNaturalTransformation([o]);
    expect(t.broken).toBe(true);
    expect(t.class).toBe('BROKEN');
  });

  it('detects coherence collapse', () => {
    const o = adaptEquilibriumTensor({ coherence: 0, preservation: 1 });
    const f = buildRuntimeFunctor([o]);
    const c = buildCoherenceConstraints([o], f);
    expect(c.collapsing).toBe(true);
  });

  it('detects equivalence fracture', () => {
    const objs = [
      adaptEquilibriumTensor({ preservation: 1, coherence: 1 }),
      adaptEquilibriumTensor({ id: 'b', preservation: 0, coherence: 0 }),
      adaptEquilibriumTensor({ id: 'c', preservation: 0, coherence: 1 }),
    ];
    const e = calculateEquivalenceRelations(objs);
    expect(e.fractured).toBe(true);
  });

  it('detects category collapse', () => {
    const objs = [
      adaptEquilibriumTensor({ id: 'a', identity: 0, preservation: 0 }),
      adaptEquilibriumTensor({ id: 'b', identity: 0, preservation: 0 }),
    ];
    const cat = buildStabilityCategory(objs);
    expect(cat.collapsed).toBe(true);
    expect(cat.classification).toBe('COLLAPSED');
  });

  it('composition detects fracture', () => {
    const objs = [
      adaptEquilibriumTensor({ id: 'a', coherence: 0, identity: 0 }),
      adaptEquilibriumTensor({ id: 'b', coherence: 0, identity: 0 }),
    ];
    const comp = composeRuntimeMorphisms(objs);
    expect(comp.fractured).toBe(true);
    expect(comp.unstable).toBe(true);
  });

  it('identity morphisms normalize default', () => {
    const objs = buildDefaultCategoryInputs();
    const i = buildIdentityMorphisms(objs);
    expect(i.normalized).toBe(true);
    expect(i.violations).toBe(0);
  });

  it('functorial collapse for degenerate functor', () => {
    const o = adaptEquilibriumTensor({ preservation: 0 });
    const cat = buildStabilityCategory([o]);
    const f = buildRuntimeFunctor([o]);
    const m = buildPropagationMorphisms([o]);
    const c = buildCoherenceConstraints([o], f);
    const col = detectFunctorialCollapse(cat, f, m, c);
    expect(col.collapsing).toBe(true);
  });

  it('aggregates category mechanics', () => {
    const objs = buildDefaultCategoryInputs();
    const e1 = buildCategoryEnvelope('a', objs);
    const e2 = buildCategoryEnvelope('b', objs);
    const agg = aggregateCategoryMechanics([e1, e2]);
    expect(agg.stable).toBe(true);
    expect(agg.envelopes.length).toBe(2);
    expect(agg.worstSeverity).toBe('info');
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

  it('observability is fail-soft and PII-free', async () => {
    await expect(emitCategoryGenerated('id', { email: 'x@y.z', safeNum: 1 })).resolves.toBeUndefined();
  });

  it('explainers return strings', () => {
    const objs = buildDefaultCategoryInputs();
    const env = buildCategoryEnvelope('e', objs);
    expect(typeof explainCategory(env.category)).toBe('string');
    expect(typeof explainFunctor(env.functor)).toBe('string');
  });

  it('envelope is deeply immutable', () => {
    const env = buildCategoryEnvelope('e', buildDefaultCategoryInputs());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.category)).toBe(true);
    expect(Object.isFrozen(env.category.objects)).toBe(true);
    expect(() => { (env as any).stable = false; }).toThrow();
  });

  it('assertAllCategoryIntegrity returns empty for default state', () => {
    const v = assertAllCategoryIntegrity();
    expect(v).toEqual([]);
  });
});
