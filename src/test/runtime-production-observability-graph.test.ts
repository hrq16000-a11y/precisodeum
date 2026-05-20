import { describe, it, expect } from 'vitest';
import {
  __runtime_production_observability_graph_internals as INT,
  normalizeMetrics,
  aggregateMetrics,
  buildProductionTelemetry,
  buildTelemetryTopology,
  buildMetricLineage,
  buildMetricCausality,
  buildConversionTelemetry,
  buildSponsorAttribution,
  propagateEngagement,
  buildFunnelTopology,
  buildSeoTelemetry,
  buildCityServiceTopology,
  buildProductionTrace,
  computeStabilitySignals,
  detectMetricCollapse,
  certifyObservability,
  buildObservabilityEnvelope,
  buildObservabilityAdapter,
  adapterAccepts,
  sanitizeObservability,
  explainObservabilityEnvelope,
  assertAllObservabilityIntegrity,
  metricsEquivalent,
  equivalenceClass,
  assertMetricDeterminism,
  type MetricSample,
} from '@/lib/runtimeProductionObservabilityGraph';

const samples: MetricSample[] = [
  { id: 'a', kind: 'counter', value: 2, parents: [] },
  { id: 'b', kind: 'conversion', value: 1, parents: ['a'] },
  { id: 'c', kind: 'engagement', value: 3, parents: ['a'] },
  { id: 'd', kind: 'sponsor', value: 5, parents: ['b'] },
];
const series = [
  { id: 's1', values: [1, 1, 1, 1] },
  { id: 's2', values: [1, 2, 1, 2, 1, 2] },
  { id: 's3', values: [1, 5, 20, 80] },
  { id: 's4', values: [] },
];

describe('runtimeProductionObservabilityGraph', () => {
  it('invariants: stage + flags false', () => {
    expect(INT.stage).toBe('STAGE_0_READ_ONLY');
    expect(INT.liveExecutionEnabled).toBe(false);
    expect(INT.retryEnabled).toBe(false);
    expect(INT.backgroundEnabled).toBe(false);
    expect(INT.realUsersAllowed).toBe(false);
  });

  it('normalization is idempotent', () => {
    const a = normalizeMetrics(samples);
    const b = normalizeMetrics(a);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('aggregation is deterministic byte-equivalent', () => {
    const a = aggregateMetrics(normalizeMetrics(samples));
    const b = aggregateMetrics(normalizeMetrics(samples.slice().reverse()));
    const det = assertMetricDeterminism(a, b);
    expect(det.deterministic).toBe(true);
  });

  it('telemetry + topology deterministic and frozen', () => {
    const t = buildProductionTelemetry({ samples });
    const g = buildTelemetryTopology(t);
    expect(Object.isFrozen(g)).toBe(true);
    expect(Object.isFrozen(g.nodes)).toBe(true);
    expect(g.signature).toMatch(/^[0-9a-f]{8}$/);
  });

  it('lineage roots detected', () => {
    const t = buildProductionTelemetry({ samples });
    const l = buildMetricLineage(t);
    expect(l.roots).toContain('a');
  });

  it('causality chains deterministic', () => {
    const t = buildProductionTelemetry({ samples });
    const l = buildMetricLineage(t);
    const c1 = buildMetricCausality(l);
    const c2 = buildMetricCausality(l);
    expect(c1.signature).toBe(c2.signature);
    expect(c1.chains.length).toBeGreaterThan(0);
  });

  it('conversion telemetry deterministic', () => {
    const c = buildConversionTelemetry([
      { id: '1', source: 'home', target: 'lead', value: 10 },
      { id: '2', source: 'seo', target: 'lead', value: 5 },
    ]);
    expect(c.totalValue).toBe(15);
    expect(Object.isFrozen(c)).toBe(true);
  });

  it('sponsor attribution ranking deterministic', () => {
    const r = buildSponsorAttribution([
      { sponsorId: 'x', slot: 'top', weight: 3 },
      { sponsorId: 'y', slot: 'top', weight: 7 },
    ]);
    expect(r.ranking[0].sponsorId).toBe('y');
    expect(r.ranking[0].share).toBeCloseTo(0.7);
  });

  it('engagement decays older signals', () => {
    const r = propagateEngagement([
      { entityId: 'p1', intensity: 10, ageDays: 0 },
      { entityId: 'p2', intensity: 10, ageDays: 28 },
    ]);
    const p1 = r.decayed.find((x) => x.entityId === 'p1')!;
    const p2 = r.decayed.find((x) => x.entityId === 'p2')!;
    expect(p1.score).toBeGreaterThan(p2.score);
  });

  it('funnel topology computes conversions', () => {
    const f = buildFunnelTopology([
      { step: 'view', order: 1, count: 100 },
      { step: 'click', order: 2, count: 50 },
      { step: 'lead', order: 3, count: 10 },
    ]);
    expect(f.overallConversion).toBeCloseTo(0.1);
    expect(f.steps[1].conversionFromPrev).toBeCloseTo(0.5);
  });

  it('seo telemetry computes ctr', () => {
    const s = buildSeoTelemetry([{ slug: 'a', impressions: 100, clicks: 5 }]);
    expect(s.entries[0].ctr).toBeCloseTo(0.05);
  });

  it('city/service topology deterministic', () => {
    const a = buildCityServiceTopology([
      { citySlug: 'sp', serviceSlug: 'x', providers: 3 },
      { citySlug: 'rj', serviceSlug: 'y', providers: 1 },
    ]);
    const b = buildCityServiceTopology([
      { citySlug: 'rj', serviceSlug: 'y', providers: 1 },
      { citySlug: 'sp', serviceSlug: 'x', providers: 3 },
    ]);
    expect(a.signature).toBe(b.signature);
  });

  it('trace builder groups spans by trace', () => {
    const t = buildProductionTrace([
      { traceId: 't1', spanId: 'a', opName: 'op', durationMs: 10 },
      { traceId: 't1', spanId: 'b', opName: 'op', durationMs: 20 },
    ]);
    expect(t.traces[0].totalDuration).toBe(30);
  });

  it('stability + convergence + collapse', () => {
    const s = computeStabilitySignals(series);
    const byId = Object.fromEntries(s.map((x) => [x.id, x.convergence]));
    expect(byId.s1).toBe('CONVERGED');
    expect(byId.s3).toBe('DIVERGENT');
    expect(byId.s4).toBe('COLLAPSED');
  });

  it('metric collapse detection', () => {
    const collapsed = detectMetricCollapse([
      { id: 'x', kind: 'counter', total: 0, count: 0, mean: NaN, signature: 'z' },
    ]);
    expect(collapsed).toContain('x');
  });

  it('certification flags unstable', () => {
    const aggs = aggregateMetrics(normalizeMetrics(samples));
    const stab = computeStabilitySignals(series);
    const c = certifyObservability(aggs, stab);
    expect(c.ok).toBe(false);
    expect(c.reasons.length).toBeGreaterThan(0);
  });

  it('observability envelope deterministic + frozen', () => {
    const e1 = buildObservabilityEnvelope(samples, series);
    const e2 = buildObservabilityEnvelope(samples.slice().reverse(), series.slice().reverse());
    expect(e1.signature).toBe(e2.signature);
    expect(Object.isFrozen(e1)).toBe(true);
  });

  it('replay equivalence', () => {
    const e1 = buildObservabilityEnvelope(samples, series);
    const e2 = buildObservabilityEnvelope(samples, series);
    expect(metricsEquivalent(e1.aggregates, e2.aggregates)).toBe(true);
    const cls = equivalenceClass([e1.aggregates, e2.aggregates]);
    expect(cls.length).toBe(1);
  });

  it('adapters inert', () => {
    const a = buildObservabilityAdapter('test');
    expect(a.inert).toBe(true);
    expect(adapterAccepts(buildObservabilityEnvelope(samples, series))).toBe(true);
  });

  it('explainers deterministic', () => {
    const env = buildObservabilityEnvelope(samples, series);
    const x1 = explainObservabilityEnvelope(env);
    const x2 = explainObservabilityEnvelope(env);
    expect(x1.bullets).toEqual(x2.bullets);
  });

  it('PII sanitization removes sensitive keys', () => {
    const dirty = {
      email: 'a@b.com',
      city: 'sp',
      token: 't',
      safe: 'ok',
      nested: { cpf: '111', metric: 1 },
    };
    const clean = sanitizeObservability(dirty);
    expect(clean.email).toBe('[REDACTED]');
    expect(clean.city).toBe('[REDACTED]');
    expect(clean.token).toBe('[REDACTED]');
    expect(clean.safe).toBe('ok');
    expect(clean.nested.cpf).toBe('[REDACTED]');
    expect(clean.nested.metric).toBe(1);
  });

  it('integrity guard passes for canonical envelope', () => {
    const env = buildObservabilityEnvelope(samples, series);
    const r = assertAllObservabilityIntegrity(env);
    expect(r.ok).toBe(true);
  });

  it('empty inputs are tolerated', () => {
    const env = buildObservabilityEnvelope([], []);
    expect(env.aggregates.length).toBe(0);
    expect(env.stability.length).toBe(0);
    expect(assertAllObservabilityIntegrity(env).ok).toBe(true);
  });

  it('recursive propagation depth (chains traverse multi-level)', () => {
    const t = buildProductionTelemetry({ samples });
    const l = buildMetricLineage(t);
    const c = buildMetricCausality(l);
    const deep = c.chains.find((ch) => ch.path.length >= 3);
    expect(deep).toBeDefined();
  });

  it('ranking ordering deterministic across permutations', () => {
    const r1 = buildSponsorAttribution([
      { sponsorId: 'a', slot: 's', weight: 1 },
      { sponsorId: 'b', slot: 's', weight: 2 },
      { sponsorId: 'c', slot: 's', weight: 3 },
    ]);
    const r2 = buildSponsorAttribution([
      { sponsorId: 'c', slot: 's', weight: 3 },
      { sponsorId: 'a', slot: 's', weight: 1 },
      { sponsorId: 'b', slot: 's', weight: 2 },
    ]);
    expect(r1.signature).toBe(r2.signature);
  });
});
