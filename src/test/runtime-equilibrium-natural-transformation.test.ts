import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ insert: async () => ({}) }) } }));

import {
  assertAllNaturalTransformationIntegrity,
  buildNaturalEnvelope,
  buildDefaultNaturalInputs,
  buildNaturalTransformation,
  buildNaturalComposition,
  buildNaturalIdentity,
  buildNaturalNormalization,
  buildNaturalDeterminism,
  buildNaturalEquivalence,
  buildNaturalReduction,
  buildNaturalTopology,
  buildNaturalStability,
  buildCommutativeDiagram,
  buildNaturalityConditions,
  aggregateNaturalMechanics,
  adaptEquilibriumFunctor,
  adaptEquilibriumCategory,
  emitNaturalTransformationGenerated,
  explainTransformation,
  explainEnvelope,
  explainDiagram,
} from '@/lib/runtimeEquilibriumNaturalTransformation';

describe('runtime equilibrium natural transformation (1.9.8)', () => {
  it('builds stable default envelope', () => {
    const comps = buildDefaultNaturalInputs();
    const env = buildNaturalEnvelope('e1', comps);
    expect(env.stable).toBe(true);
    expect(env.transformation.class).toBe('NATURAL');
    expect(env.composition.class).toBe('ASSOCIATIVE');
    expect(env.identity.class).toBe('PRESERVED');
    expect(env.normalization.idempotent).toBe(true);
    expect(env.determinism.class).toBe('DETERMINISTIC');
    expect(env.topology.class).toBe('STABLE');
    expect(env.stability.class).toBe('STABLE');
    expect(env.diagram.class).toBe('COMMUTATIVE');
    expect(env.naturalityConditions.satisfied).toBe(true);
    expect(env.certification.safe).toBe(true);
  });

  it('is deterministic (same input → byte-equivalent JSON)', () => {
    const comps = buildDefaultNaturalInputs();
    const a = buildNaturalEnvelope('x', comps);
    const b = buildNaturalEnvelope('x', comps);
    expect(a.transformation.signature).toBe(b.transformation.signature);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('preserves identity for defaults', () => {
    const comps = buildDefaultNaturalInputs();
    const i = buildNaturalIdentity(comps);
    expect(i.broken).toBe(false);
    expect(i.violations).toBe(0);
    expect(i.preservation).toBeGreaterThan(0.9);
  });

  it('composition is associative for defaults', () => {
    const c = buildNaturalComposition(buildDefaultNaturalInputs());
    expect(c.class).toBe('ASSOCIATIVE');
    expect(c.broken).toBe(false);
  });

  it('reduction is idempotent for defaults', () => {
    const r = buildNaturalReduction(buildDefaultNaturalInputs());
    expect(r.idempotent).toBe(true);
    const r2 = buildNaturalReduction(buildDefaultNaturalInputs());
    expect(JSON.stringify(r)).toBe(JSON.stringify(r2));
  });

  it('detects transformation collapse', () => {
    const c = adaptEquilibriumFunctor({ naturality: 0, identity: 0 });
    const t = buildNaturalTransformation([c]);
    expect(t.collapsed).toBe(true);
    expect(t.class).toBe('DEGENERATE');
  });

  it('detects identity break', () => {
    const c = adaptEquilibriumFunctor({ identity: 0 });
    const i = buildNaturalIdentity([c]);
    expect(i.broken).toBe(true);
    expect(i.class).toBe('BROKEN');
  });

  it('detects composition broken', () => {
    const c = adaptEquilibriumFunctor({ naturality: 0.1, identity: 0.1 });
    const comp = buildNaturalComposition([c]);
    expect(comp.broken).toBe(true);
  });

  it('detects determinism degradation', () => {
    const c = adaptEquilibriumFunctor({ determinism: 0 });
    const d = buildNaturalDeterminism([c]);
    expect(d.degraded).toBe(true);
    expect(d.class).toBe('NONDETERMINISTIC');
  });

  it('detects equivalence regression/fracture', () => {
    const comps = [
      adaptEquilibriumFunctor({ id: 'a', naturality: 1, identity: 1, determinism: 1 }),
      adaptEquilibriumFunctor({ id: 'b', naturality: 0, identity: 0, determinism: 0 }),
      adaptEquilibriumFunctor({ id: 'c', naturality: 1, identity: 0, determinism: 1 }),
    ];
    const e = buildNaturalEquivalence(comps);
    expect(['FRACTURED', 'REGRESSED', 'WEAK']).toContain(e.class);
    expect(e.class).not.toBe('EQUIVALENT');
  });

  it('detects topology collapse for invalid morphisms', () => {
    const c = adaptEquilibriumFunctor({ morphisms: Object.freeze(['nonexistent:0', 'orphan:1']) });
    const t = buildNaturalTopology([c]);
    expect(t.collapsed).toBe(true);
  });

  it('detects commutative diagram failure', () => {
    const c = adaptEquilibriumFunctor({ commutativity: 0 });
    const d = buildCommutativeDiagram([c]);
    expect(d.failed).toBe(true);
    expect(d.class).toBe('BROKEN');
  });

  it('detects naturality conditions violation', () => {
    const c = adaptEquilibriumFunctor({ naturality: 0.2, commutativity: 0.2 });
    const n = buildNaturalityConditions([c]);
    expect(n.satisfied).toBe(false);
    expect(n.violations).toBeGreaterThan(0);
  });

  it('stability collapses on degenerate inputs', () => {
    const c = adaptEquilibriumFunctor({ naturality: 0, identity: 0, stability: 0, morphisms: Object.freeze(['x:0']) });
    const t = buildNaturalTransformation([c]);
    const comp = buildNaturalComposition(t.components);
    const i = buildNaturalIdentity(t.components);
    const n = buildNaturalNormalization(t.components);
    const top = buildNaturalTopology(t.components);
    const s = buildNaturalStability(comp, i, n, top);
    expect(s.collapsed || s.unstable).toBe(true);
  });

  it('aggregates natural mechanics deterministically', () => {
    const comps = buildDefaultNaturalInputs();
    const e1 = buildNaturalEnvelope('a', comps);
    const e2 = buildNaturalEnvelope('b', comps);
    const agg = aggregateNaturalMechanics([e1, e2]);
    expect(agg.stable).toBe(true);
    expect(agg.envelopes.length).toBe(2);
    expect(agg.worstSeverity).toBe('info');
    expect(agg.worstNatural).toBe('NATURAL');
    expect(agg.worstDiagram).toBe('COMMUTATIVE');
  });

  it('adapters produce frozen, inert objects', () => {
    const c = adaptEquilibriumCategory({});
    expect(Object.isFrozen(c)).toBe(true);
    expect(c.liveExecutionEnabled).toBe(false);
    expect(c.retryEnabled).toBe(false);
    expect(c.backgroundEnabled).toBe(false);
    expect(c.realUsersAllowed).toBe(false);
    expect(c.stage).toBe('STAGE_0_READ_ONLY');
  });

  it('does not mutate input snapshots', () => {
    const comps = buildDefaultNaturalInputs();
    const before = JSON.stringify(comps);
    buildNaturalEnvelope('x', comps);
    expect(JSON.stringify(comps)).toBe(before);
  });

  it('observability is fail-soft and PII-free', async () => {
    await expect(emitNaturalTransformationGenerated('id', { email: 'x@y.z', safe: 1 })).resolves.toBeUndefined();
  });

  it('explainers return deterministic strings', () => {
    const env = buildNaturalEnvelope('e', buildDefaultNaturalInputs());
    expect(typeof explainTransformation(env.transformation)).toBe('string');
    expect(typeof explainEnvelope(env)).toBe('string');
    expect(typeof explainDiagram(env.diagram)).toBe('string');
    expect(explainTransformation(env.transformation)).toBe(explainTransformation(env.transformation));
  });

  it('envelope is deeply immutable', () => {
    const env = buildNaturalEnvelope('e', buildDefaultNaturalInputs());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.transformation)).toBe(true);
    expect(Object.isFrozen(env.transformation.components)).toBe(true);
    expect(() => { (env as { stable: boolean }).stable = false; }).toThrow();
  });

  it('assertAllNaturalTransformationIntegrity returns empty for default state', () => {
    const v = assertAllNaturalTransformationIntegrity();
    expect(v).toEqual([]);
  });
});
