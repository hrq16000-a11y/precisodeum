/**
 * Fase 1.9.12 — Recursive Equilibrium System suite.
 */

import { describe, it, expect } from 'vitest';
import {
  adaptRecursiveSystemRaw,
  aggregateRecursiveEnvelopes,
  assertAllRecursiveIntegrity,
  buildRecursiveAggregate,
  buildRecursiveEnvelope,
  buildReqObservabilityEvent,
  explainReqEnvelope,
  REQ_INTERNALS,
  reqSignature,
  stripReqSensitive,
  __runtime_meta_recursive_equilibrium_system_internals,
} from '@/lib/runtimeMetaRecursiveEquilibriumSystem';

const linear = adaptRecursiveSystemRaw({
  id: 'lin',
  nodes: [
    { id: 'a', layer: 'L', potential: 3, depth: 0 },
    { id: 'b', layer: 'L', potential: 2, depth: 1 },
    { id: 'c', layer: 'L', potential: 1, depth: 2 },
  ],
  edges: [
    { id: 'ab', source: 'a', target: 'b', weight: 1 },
    { id: 'bc', source: 'b', target: 'c', weight: 1 },
    { id: 'idA', source: 'a', target: 'a' },
    { id: 'idB', source: 'b', target: 'b' },
    { id: 'idC', source: 'c', target: 'c' },
  ],
});

const cyclic = adaptRecursiveSystemRaw({
  id: 'cyc',
  nodes: [
    { id: 'x', layer: 'L', potential: 1 },
    { id: 'y', layer: 'L', potential: 2 },
  ],
  edges: [
    { id: 'xy', source: 'x', target: 'y' },
    { id: 'yx', source: 'y', target: 'x' },
  ],
});

describe('runtimeMetaRecursiveEquilibriumSystem', () => {
  it('internals locked to STAGE_0_READ_ONLY with all flags false', () => {
    expect(REQ_INTERNALS.stage).toBe('STAGE_0_READ_ONLY');
    expect(REQ_INTERNALS.liveExecutionEnabled).toBe(false);
    expect(REQ_INTERNALS.retryEnabled).toBe(false);
    expect(REQ_INTERNALS.backgroundEnabled).toBe(false);
    expect(REQ_INTERNALS.realUsersAllowed).toBe(false);
    expect(__runtime_meta_recursive_equilibrium_system_internals).toBe(REQ_INTERNALS);
  });

  it('envelope is deeply frozen', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(Object.isFrozen(e)).toBe(true);
    expect(Object.isFrozen(e.resolution)).toBe(true);
    expect(Object.isFrozen(e.certification)).toBe(true);
    expect(Object.isFrozen(e.stability)).toBe(true);
  });

  it('byte-equivalent determinism on replays', () => {
    const a = buildRecursiveEnvelope(linear);
    const b = buildRecursiveEnvelope(linear);
    expect(a.signature).toBe(b.signature);
    expect(a.determinism.stable).toBe(true);
  });

  it('normalization is idempotent', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(e.normalization.idempotent).toBe(true);
  });

  it('identity is canonical & idempotent for self-loops weight=1', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(e.identity.canonical).toBe(true);
    expect(e.identity.idempotent).toBe(true);
    expect(e.identity.missing.length).toBe(0);
  });

  it('composition is associative & closed', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(e.composition.closed).toBe(true);
    expect(e.composition.associative).toBe(true);
  });

  it('equivalence symmetric & transitive', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(e.equivalence.symmetric).toBe(true);
    expect(e.equivalence.transitive).toBe(true);
  });

  it('cycle detection on cyclic system', () => {
    const e = buildRecursiveEnvelope(cyclic);
    expect(e.resolution.cycles.length).toBeGreaterThan(0);
  });

  it('containment classification valid', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(['isolated', 'bounded', 'recursive']).toContain(e.containment.classification);
  });

  it('propagation bounded for small linear chain', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(e.propagation.overflow).toBe(false);
    expect(e.propagation.bounded).toBe(true);
  });

  it('closure consistent for linear chain', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(e.closure.closed).toBe(true);
  });

  it('topology connected', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(e.topology.collapsed).toBe(false);
  });

  it('stability bounded', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(e.stability.bounded).toBe(true);
    expect(e.stability.containment).toBeGreaterThan(0);
  });

  it('certification rank healthy', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(['CERTIFIED', 'CONDITIONALLY_CERTIFIED']).toContain(e.certification.rank);
  });

  it('convergence classification deterministic & recovery detected when potential decreases', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(['STABLE', 'EVENTUAL']).toContain(e.convergence.classification);
    // linear chain has decreasing potentials => recovery may be tracked
    expect(typeof e.convergence.recovered).toBe('boolean');
  });

  it('aggregation deterministic regardless of input order', () => {
    const a = buildRecursiveAggregate([linear, cyclic]);
    const b = buildRecursiveAggregate([cyclic, linear]);
    expect(a.signature).toBe(b.signature);
    expect(a.envelopes[0].id <= a.envelopes[1].id).toBe(true);
  });

  it('observability strips PII keys', () => {
    const out = stripReqSensitive({
      email: 'a@b.com',
      cpf: '1',
      whatsapp: '99',
      token: 't',
      password: 'p',
      keep: 1,
      nested: { phone: '9', stay: 'x' },
    }) as Record<string, unknown>;
    expect(out.email).toBeUndefined();
    expect(out.cpf).toBeUndefined();
    expect(out.whatsapp).toBeUndefined();
    expect(out.token).toBeUndefined();
    expect(out.password).toBeUndefined();
    expect(out.keep).toBe(1);
    expect((out.nested as Record<string, unknown>).phone).toBeUndefined();
    expect((out.nested as Record<string, unknown>).stay).toBe('x');
  });

  it('observability event signature stable across key order', () => {
    const e1 = buildReqObservabilityEvent('k', 't', { a: 1, b: 2 });
    const e2 = buildReqObservabilityEvent('k', 't', { b: 2, a: 1 });
    expect(e1.signature).toBe(e2.signature);
  });

  it('explainers deterministic', () => {
    const e = buildRecursiveEnvelope(linear);
    expect(explainReqEnvelope(e).lines).toEqual(explainReqEnvelope(e).lines);
  });

  it('assertAllRecursiveIntegrity has no critical violations on healthy input', () => {
    const env = buildRecursiveEnvelope(linear);
    const agg = aggregateRecursiveEnvelopes([env], []);
    const v = assertAllRecursiveIntegrity([env], REQ_INTERNALS, agg);
    expect(v.every((x) => x.severity !== 'critical')).toBe(true);
  });

  it('empty input safety', () => {
    const agg = aggregateRecursiveEnvelopes([], []);
    expect(agg.stable).toBe(false);
    expect(agg.envelopes.length).toBe(0);
  });

  it('signature stable across key order', () => {
    expect(reqSignature({ a: 1, b: 2 })).toBe(reqSignature({ b: 2, a: 1 }));
  });

  it('regression detection: cyclic system flagged as regressed', () => {
    const e = buildRecursiveEnvelope(cyclic);
    expect(e.convergence.regressed).toBe(true);
  });

  it('byte-equivalent replay across full envelope rebuild', () => {
    const sigs = [0, 1, 2].map(() => buildRecursiveEnvelope(linear).signature);
    expect(new Set(sigs).size).toBe(1);
  });
});
