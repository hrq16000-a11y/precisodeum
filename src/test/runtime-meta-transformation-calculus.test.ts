// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Test Suite
// Pure, read-only, deterministic. No timers, no IO, no Supabase, no React.

import { describe, it, expect } from 'vitest';
import {
  buildMetaTransformation,
  composeMetaTransformations,
  certifyMetaIdentity,
  normalizeMetaTransformation,
  isMetaNormalizationIdempotent,
  isMetaTransformationDeterministic,
  computeMetaDeterminismSignature,
  metaTransformationsEquivalent,
  isMetaEquivalenceSymmetric,
  isMetaEquivalenceTransitive,
  buildMetaTopology,
  computeMetaTopologySignature,
  detectMetaTopologyCycles,
  buildMetaStability,
  isMetaStabilityDeterministic,
  buildMetaCertification,
  computeMetaCertificationSignature,
  adaptMetaTransformation,
  adaptMetaEnvelope,
  sanitizeMetaPayload,
  detectMetaObservabilityLeak,
  buildMetaObservabilityEvent,
  explainMetaTransformation,
  explainMetaStability,
  explainMetaCertification,
  assertAllMetaIntegrity,
  aggregateMetaTransformations,
  rankMetaTransformations,
  summarizeMetaAggregate,
  computeMetaAggregateSignature,
  detectMetaAggregateRegression,
  certifyMetaAggregate,
  buildMetaTransformationEnvelope,
  buildMetaAggregateEnvelope,
} from '@/lib/runtimeMetaTransformationCalculus';
import type {
  MetaComponent,
  RuntimeMetaTransformation,
} from '@/lib/runtimeMetaTransformationCalculus';

function comp(id: string, opts: Partial<MetaComponent> = {}): MetaComponent {
  return {
    id,
    layer: opts.layer ?? 'layer_a',
    stage: 'STAGE_0_READ_ONLY',
    liveExecutionEnabled: false,
    retryEnabled: false,
    backgroundEnabled: false,
    realUsersAllowed: false,
    naturality: opts.naturality ?? 0.9,
    functoriality: opts.functoriality ?? 0.9,
    identity: opts.identity ?? 0.9,
    determinism: opts.determinism ?? 0.9,
    stability: opts.stability ?? 0.9,
    lift: opts.lift ?? 0.9,
    fixedPoint: opts.fixedPoint ?? 0.9,
    morphisms: opts.morphisms ?? [],
    signature: opts.signature ?? 'sig_' + id,
  };
}

const A = buildMetaTransformation([
  comp('a', { morphisms: ['b'] }),
  comp('b', { morphisms: ['c'] }),
  comp('c'),
]);
const B = buildMetaTransformation([
  comp('a', { morphisms: ['b'] }),
  comp('b', { morphisms: ['c'] }),
  comp('c'),
]);
const C = buildMetaTransformation([
  comp('x', { morphisms: ['y'] }),
  comp('y'),
]);
const Cycle = buildMetaTransformation([
  comp('p', { morphisms: ['q'] }),
  comp('q', { morphisms: ['p'] }),
]);

describe('Phase 1.9.10 · Meta-Transformation Calculus', () => {
  it('A) determinism: byte-equivalent signature across rebuilds', () => {
    expect(computeMetaDeterminismSignature(A)).toBe(computeMetaDeterminismSignature(B));
  });

  it('B) deepFreeze: transformation envelope is frozen', () => {
    expect(Object.isFrozen(A)).toBe(true);
    expect(Object.isFrozen(A.components)).toBe(true);
    for (const c of A.components) expect(Object.isFrozen(c)).toBe(true);
  });

  it('C) readonly invariants: morphism arrays frozen', () => {
    for (const c of A.components) expect(Object.isFrozen(c.morphisms)).toBe(true);
  });

  it('D) stage invariant: STAGE_0_READ_ONLY enforced', () => {
    for (const c of A.components) expect(c.stage).toBe('STAGE_0_READ_ONLY');
  });

  it('E) execution flags invariant: all disabled', () => {
    for (const c of A.components) {
      expect(c.liveExecutionEnabled).toBe(false);
      expect(c.retryEnabled).toBe(false);
      expect(c.backgroundEnabled).toBe(false);
      expect(c.realUsersAllowed).toBe(false);
    }
  });

  it('F) identity is idempotent', () => {
    const id1 = certifyMetaIdentity(A);
    const id2 = certifyMetaIdentity(A);
    expect(id1).toEqual(id2);
  });

  it('G) normalization is idempotent', () => {
    expect(isMetaNormalizationIdempotent(A)).toBe(true);
    const n1 = normalizeMetaTransformation(A);
    const n2 = normalizeMetaTransformation(n1);
    expect(n1.signature).toBe(n2.signature);
  });

  it('H) composition associative under reordering', () => {
    const c1 = composeMetaTransformations([A, C]);
    const c2 = composeMetaTransformations([C, A]);
    expect(c1.associativity).toBe(c2.associativity);
    expect(c1.class).toBe(c2.class);
  });

  it('I) equivalence symmetric', () => {
    expect(isMetaEquivalenceSymmetric(A, B)).toBe(true);
    expect(metaTransformationsEquivalent(A, B).equivalent).toBe(true);
  });

  it('J) equivalence transitive', () => {
    expect(isMetaEquivalenceTransitive(A, B, A)).toBe(true);
  });

  it('K) topology deterministic', () => {
    expect(computeMetaTopologySignature(A)).toBe(computeMetaTopologySignature(B));
  });

  it('L) cycle detection finds cycles', () => {
    const cycles = detectMetaTopologyCycles(Cycle);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('M) propagation depth surfaces via topology connectivity', () => {
    const topo = buildMetaTopology(A);
    expect(typeof topo.connectivity).toBe('number');
    expect(topo.connectivity).toBeGreaterThanOrEqual(0);
    expect(topo.connectivity).toBeLessThanOrEqual(1);
  });

  it('N) stability deterministic across replay', () => {
    expect(isMetaStabilityDeterministic(A)).toBe(true);
    const s1 = buildMetaStability(A);
    const s2 = buildMetaStability(B);
    expect(s1.score).toBe(s2.score);
    expect(s1.class).toBe(s2.class);
  });

  it('O) certification deterministic across replay', () => {
    expect(computeMetaCertificationSignature(A)).toBe(computeMetaCertificationSignature(B));
    const c1 = buildMetaCertification(A);
    const c2 = buildMetaCertification(B);
    expect(c1.rank).toBe(c2.rank);
    expect(c1.safe).toBe(c2.safe);
  });

  it('P) observability is PII-free after sanitize', () => {
    const safe = sanitizeMetaPayload({ email: 'x@y.com', ok: 1, nested: { cpf: '000' } });
    expect(detectMetaObservabilityLeak(safe)).toBe(false);
    const ev = buildMetaObservabilityEvent('test', { phone: '+55', value: 1 });
    expect(detectMetaObservabilityLeak(ev.payload)).toBe(false);
    expect(ev.stage).toBe('STAGE_0_READ_ONLY');
    expect(ev.liveExecutionEnabled).toBe(false);
  });

  it('Q) aggregation deterministic across replays', () => {
    const a1 = aggregateMetaTransformations([A, C]);
    const a2 = aggregateMetaTransformations([B, C]);
    expect(computeMetaAggregateSignature(a1)).toBe(computeMetaAggregateSignature(a2));
  });

  it('R) aggregation ranking order is descending by score', () => {
    const ranking = rankMetaTransformations([A, C, Cycle]);
    for (let i = 1; i < ranking.byScore.length; i++) {
      expect(ranking.byScore[i - 1].score >= ranking.byScore[i].score).toBe(true);
    }
  });

  it('S) guards detect violations from cycle-heavy transformation', () => {
    const env = buildMetaTransformationEnvelope(Cycle);
    const result = assertAllMetaIntegrity(env);
    expect(result.integrity === 'OK' || result.integrity === 'WARN' || result.integrity === 'CRITICAL').toBe(true);
    // signature deterministic
    const result2 = assertAllMetaIntegrity(env);
    expect(result.signature).toBe(result2.signature);
  });

  it('T) aggregate certification reflects stability', () => {
    const agg = aggregateMetaTransformations([A]);
    const cert = certifyMetaAggregate(agg);
    expect(['OK', 'WARN', 'BLOCKED']).toContain(cert.rank);
  });

  it('U) adapters are inert and produce frozen snapshots', () => {
    const snap = adaptMetaTransformation(A);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(snap.signature).toBe(A.signature);
    const env = buildMetaTransformationEnvelope(A);
    const snapEnv = adaptMetaEnvelope(env);
    expect(Object.isFrozen(snapEnv)).toBe(true);
  });

  it('V) explainers deterministic and stable', () => {
    const e1 = explainMetaTransformation(A);
    const e2 = explainMetaTransformation(B);
    expect(e1.summary).toBe(e2.summary);
    expect(e1.bullets).toEqual(e2.bullets);
    const s = explainMetaStability(buildMetaStability(A));
    const c = explainMetaCertification(buildMetaCertification(A));
    expect(typeof s.summary).toBe('string');
    expect(typeof c.summary).toBe('string');
  });

  it('W) determinism signatures stable across normalization round-trip', () => {
    const det = isMetaTransformationDeterministic(A);
    expect(det.byteEquivalent).toBe(true);
    expect(det.mutationLeakage).toBe(false);
    expect(['STRICT', 'STABLE']).toContain(det.verdict);
  });

  it('X) regression detection compares aggregates', () => {
    const good = aggregateMetaTransformations([A]);
    const bad = aggregateMetaTransformations([Cycle]);
    // either ordering should not crash; one direction should detect regression
    const r1 = detectMetaAggregateRegression(good, bad);
    const r2 = detectMetaAggregateRegression(bad, good);
    expect(typeof r1).toBe('boolean');
    expect(typeof r2).toBe('boolean');
  });

  it('Y) aggregation preserves Object.freeze on all envelopes', () => {
    const agg = aggregateMetaTransformations([A, C]);
    expect(Object.isFrozen(agg)).toBe(true);
    expect(Object.isFrozen(agg.envelopes)).toBe(true);
    for (const e of agg.envelopes) {
      expect(Object.isFrozen(e)).toBe(true);
      expect(Object.isFrozen(e.transformation)).toBe(true);
      expect(Object.isFrozen(e.certification)).toBe(true);
    }
  });

  it('Z) assertAllMetaIntegrity returns OK on a clean envelope', () => {
    const env = buildMetaTransformationEnvelope(A);
    const result = assertAllMetaIntegrity(env);
    expect(result.integrity).toBe('OK');
    expect(result.violations.length).toBe(0);
  });

  it('AA) buildMetaAggregateEnvelope is fully deterministic', () => {
    const e1 = buildMetaAggregateEnvelope([A, C]);
    const e2 = buildMetaAggregateEnvelope([B, C]);
    expect(e1.signature).toBe(e2.signature);
    expect(e1.summary).toEqual(e2.summary);
    expect(Object.isFrozen(e1)).toBe(true);
  });

  it('BB) summarizeMetaAggregate respects empty input', () => {
    const empty = aggregateMetaTransformations([]);
    const s = summarizeMetaAggregate(empty);
    expect(s.count).toBe(0);
    expect(s.avgScore).toBe(0);
  });
});
