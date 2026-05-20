/**
 * Fase 1.9.11 — Suite for runtimeMetaFixedPointCategory.
 */

import { describe, it, expect } from 'vitest';
import {
  adaptCategoryRaw,
  aggregateEnvelopes,
  assertAllFixedPointIntegrity,
  buildFixedPointAggregate,
  buildFixedPointEnvelope,
  buildFpcObservabilityEvent,
  explainEnvelope,
  FPC_INTERNALS,
  fpcSignature,
  stripFpcSensitive,
  __runtime_meta_fixed_point_category_internals,
} from '@/lib/runtimeMetaFixedPointCategory';

const linearCat = adaptCategoryRaw({
  id: 'linear',
  objects: [
    { id: 'a', layer: 'L', value: 1 },
    { id: 'b', layer: 'L', value: 2 },
    { id: 'c', layer: 'L', value: 3 },
  ],
  morphisms: [
    { id: 'ab', source: 'a', target: 'b', weight: 1 },
    { id: 'bc', source: 'b', target: 'c', weight: 1 },
    { id: 'idA', source: 'a', target: 'a' },
    { id: 'idB', source: 'b', target: 'b' },
    { id: 'idC', source: 'c', target: 'c' },
  ],
});

const cyclicCat = adaptCategoryRaw({
  id: 'cyclic',
  objects: [
    { id: 'x', layer: 'L', value: 1 },
    { id: 'y', layer: 'L', value: 2 },
  ],
  morphisms: [
    { id: 'xy', source: 'x', target: 'y' },
    { id: 'yx', source: 'y', target: 'x' },
  ],
});

describe('runtimeMetaFixedPointCategory', () => {
  it('internals are STAGE_0_READ_ONLY with all flags false', () => {
    expect(FPC_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(FPC_INTERNALS.liveExecutionEnabled).toBe(false);
    expect(FPC_INTERNALS.retryEnabled).toBe(false);
    expect(FPC_INTERNALS.backgroundEnabled).toBe(false);
    expect(FPC_INTERNALS.realUsersAllowed).toBe(false);
    expect(__runtime_meta_fixed_point_category_internals).toBe(FPC_INTERNALS);
  });

  it('envelope is deeply frozen', () => {
    const e = buildFixedPointEnvelope(linearCat);
    expect(Object.isFrozen(e)).toBe(true);
    expect(Object.isFrozen(e.resolution)).toBe(true);
    expect(Object.isFrozen(e.certification)).toBe(true);
  });

  it('byte-equivalent determinism on replays', () => {
    const a = buildFixedPointEnvelope(linearCat);
    const b = buildFixedPointEnvelope(linearCat);
    expect(a.signature).toBe(b.signature);
    expect(a.normalization.signature).toBe(b.normalization.signature);
  });

  it('normalization is idempotent', () => {
    const e = buildFixedPointEnvelope(linearCat);
    expect(e.normalization.idempotent).toBe(true);
    expect(e.determinism.stable).toBe(true);
  });

  it('identity check detects canonical identities', () => {
    const e = buildFixedPointEnvelope(linearCat);
    expect(e.identity.canonical).toBe(true);
    expect(e.identity.missing.length).toBe(0);
  });

  it('cycle detection on cyclic category', () => {
    const e = buildFixedPointEnvelope(cyclicCat);
    expect(e.resolution.cycles.length).toBeGreaterThan(0);
    expect(e.convergence.classification === 'OSCILLATING' || e.convergence.classification === 'EVENTUAL').toBe(true);
  });

  it('containment classification', () => {
    const e = buildFixedPointEnvelope(linearCat);
    expect(['isolated', 'bounded', 'recursive']).toContain(e.containment.classification);
    const c = buildFixedPointEnvelope(cyclicCat);
    expect(['recursive', 'bounded', 'isolated']).toContain(c.containment.classification);
  });

  it('topology connected for linear chain', () => {
    const e = buildFixedPointEnvelope(linearCat);
    expect(e.topology.collapsed).toBe(false);
  });

  it('stability bounded', () => {
    const e = buildFixedPointEnvelope(linearCat);
    expect(e.stability.bounded).toBe(true);
    expect(e.stability.containment).toBeGreaterThan(0);
  });

  it('certification rank is CERTIFIED or CONDITIONALLY_CERTIFIED', () => {
    const e = buildFixedPointEnvelope(linearCat);
    expect(['CERTIFIED', 'CONDITIONALLY_CERTIFIED']).toContain(e.certification.rank);
  });

  it('equivalence is symmetric & transitive', () => {
    const e = buildFixedPointEnvelope(linearCat);
    expect(e.equivalence.symmetric).toBe(true);
    expect(e.equivalence.transitive).toBe(true);
  });

  it('closure consistency', () => {
    const e = buildFixedPointEnvelope(linearCat);
    expect(e.closure.closed).toBe(true);
  });

  it('aggregation is deterministic & sorted', () => {
    const a = buildFixedPointAggregate([linearCat, cyclicCat]);
    const b = buildFixedPointAggregate([cyclicCat, linearCat]);
    expect(a.signature).toBe(b.signature);
    expect(a.envelopes[0].id <= a.envelopes[1].id).toBe(true);
  });

  it('observability strips PII keys', () => {
    const sanitized = stripFpcSensitive({
      email: 'a@b.com',
      cpf: '12345678900',
      token: 't',
      keep: 1,
      nested: { phone: '99', stay: 'x' },
    }) as Record<string, unknown>;
    expect(sanitized.email).toBeUndefined();
    expect(sanitized.cpf).toBeUndefined();
    expect(sanitized.token).toBeUndefined();
    expect(sanitized.keep).toBe(1);
    expect((sanitized.nested as Record<string, unknown>).phone).toBeUndefined();
    expect((sanitized.nested as Record<string, unknown>).stay).toBe('x');
  });

  it('observability event signature is stable', () => {
    const e1 = buildFpcObservabilityEvent('test', 't1', { a: 1, b: 2 });
    const e2 = buildFpcObservabilityEvent('test', 't1', { b: 2, a: 1 });
    expect(e1.signature).toBe(e2.signature);
  });

  it('explainers are deterministic', () => {
    const e = buildFixedPointEnvelope(linearCat);
    const x1 = explainEnvelope(e);
    const x2 = explainEnvelope(e);
    expect(x1.lines).toEqual(x2.lines);
  });

  it('aggregate integrity finds no critical violations on healthy input', () => {
    const env = buildFixedPointEnvelope(linearCat);
    const agg = aggregateEnvelopes([env], []);
    const violations = assertAllFixedPointIntegrity([env], FPC_INTERNALS, agg);
    expect(violations.every((v) => v.severity !== 'critical')).toBe(true);
  });

  it('empty input safety', () => {
    const agg = aggregateEnvelopes([], []);
    expect(agg.stable).toBe(false);
    expect(agg.envelopes.length).toBe(0);
  });

  it('fpcSignature is stable across key order', () => {
    expect(fpcSignature({ a: 1, b: 2 })).toBe(fpcSignature({ b: 2, a: 1 }));
  });
});
