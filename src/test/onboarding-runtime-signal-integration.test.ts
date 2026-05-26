/**
 * Runtime Signal Integration Layer — testes determinísticos.
 * Cobre: normalização, corrupção, órfãos, lineage, contradições,
 * confirmações multi-engine, reconstrução forense, releases, incidentes,
 * experimentos, gaps de visibilidade, snapshots stale, cobertura, fail-soft.
 */

import { describe, it, expect } from 'vitest';
import {
  runtimeSignalAdapter,
  integrateRuntimeSignals,
  computeSignalQuality,
  buildEvidenceFeed,
  reconstructOperationalSession,
  computeSystemicCoverage,
  RUNTIME_SIGNAL_POLICY,
} from '@/lib/onboarding/runtimeSignalAdapter';

const NOW = 1_700_000_000_000;
const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

function mkEvent(p: Partial<any> = {}) {
  return {
    id: p.id ?? `evt-${Math.random()}`,
    phase: 'phase2_service',
    event: 'next',
    session_id: 'sess-A',
    user_id: 'u1',
    created_at: NOW,
    meta: { app_version: '1.1.0', ...p.meta },
    ...p,
  };
}

describe('runtimeSignalAdapter — normalização e fail-soft', () => {
  it('normaliza eventos válidos', () => {
    const out = runtimeSignalAdapter({ events: [mkEvent()] });
    expect(out.normalizedSignals).toHaveLength(1);
    expect(out.normalizedSignals[0].kind).toBe('event');
    expect(out.signalIntegrity).toBe(100);
  });

  it('lida com input vazio sem lançar', () => {
    const out = runtimeSignalAdapter({});
    expect(out.normalizedSignals).toHaveLength(0);
    expect(out.signalCoverage).toBe(0);
    expect(out.missingSignals.length).toBeGreaterThan(0);
  });

  it('marca sinais corrompidos (campos críticos ausentes)', () => {
    const out = runtimeSignalAdapter({ events: [{ id: 'x' }] }); // sem phase/event
    expect(out.corruptedSignals).toContain('x');
    expect(out.signalIntegrity).toBeLessThan(100);
  });

  it('sobrevive a entradas não-objeto', () => {
    const out = runtimeSignalAdapter({ events: [null, undefined, 42, 'x'] as any });
    expect(out.normalizedSignals.length).toBeLessThanOrEqual(1);
  });

  it('computa missingSignals corretamente', () => {
    const out = runtimeSignalAdapter({ events: [mkEvent()] });
    expect(out.missingSignals).toContain('onboarding_incidents');
    expect(out.missingSignals).not.toContain('onboarding_events');
  });

  it('reporta coverage proporcional', () => {
    const out = runtimeSignalAdapter({
      events: [mkEvent()],
      incidents: [{ id: 'i1', severity: 'high', phase: 'phase2_service' }],
      releases: [{ id: 'r1', app_version: '1.1.0', captured_at: NOW }],
    });
    expect(out.signalCoverage).toBeGreaterThan(20);
  });

  it('ordena sinais por timestamp', () => {
    const out = runtimeSignalAdapter({
      events: [mkEvent({ id: 'b', created_at: NOW + 100 }), mkEvent({ id: 'a', created_at: NOW })],
    });
    expect(out.normalizedSignals[0].id).toBe('a');
  });

  it('sanitiza meta removendo PII', () => {
    const out = runtimeSignalAdapter({
      events: [mkEvent({ meta: { email: 'a@b.com', cpf: '123', ok: 1 } })],
    });
    expect(out.normalizedSignals[0].meta).not.toHaveProperty('email');
    expect(out.normalizedSignals[0].meta).not.toHaveProperty('cpf');
    expect(out.normalizedSignals[0].meta).toHaveProperty('ok');
  });

  it('política frozen impede mutação', () => {
    expect(() => {
      (RUNTIME_SIGNAL_POLICY as any).allow_mutation = true;
    }).toThrow();
  });
});

describe('integrateRuntimeSignals — distribuição entre engines', () => {
  it('roteia eventos para reality/evidence/correlation', () => {
    const out = runtimeSignalAdapter({ events: [mkEvent()] });
    const r = integrateRuntimeSignals(out.normalizedSignals);
    expect(r.byEngine.operationalReality).toBe(1);
    expect(r.byEngine.evidenceCorrelation).toBe(1);
    expect(r.byEngine.operationalCorrelation).toBe(1);
  });

  it('roteia incidents para memory + reality', () => {
    const out = runtimeSignalAdapter({
      incidents: [{ id: 'i1', severity: 'high', phase: 'phase2_service' }],
    });
    const r = integrateRuntimeSignals(out.normalizedSignals);
    expect(r.byEngine.operationalMemory).toBe(1);
    expect(r.byEngine.operationalReality).toBe(1);
  });

  it('roteia flags/experiments para governance/decision', () => {
    const out = runtimeSignalAdapter({
      flags: [{ key: 'feature_x', value: true, updated_at: NOW }],
      experiments: [{ id: 'e1', status: 'running', target_phase: 'phase2_service' }],
    });
    const r = integrateRuntimeSignals(out.normalizedSignals);
    expect(r.byEngine.runtimeGovernance).toBe(2);
    expect(r.byEngine.decisionEngine).toBe(2);
  });

  it('roteia hardening para hardening engine', () => {
    const out = runtimeSignalAdapter({
      hardening: [{ id: 'h1', type: 'chaos', severity: 'low' }],
    });
    const r = integrateRuntimeSignals(out.normalizedSignals);
    expect(r.byEngine.hardening).toBe(1);
  });

  it('roteia releases/regressions para self-audit', () => {
    const out = runtimeSignalAdapter({
      releases: [{ id: 'r1', app_version: '1.0.0', captured_at: NOW }],
      regressions: [{ id: 'rg1', type: 'metric_drop' }],
    });
    const r = integrateRuntimeSignals(out.normalizedSignals);
    expect(r.byEngine.selfAudit).toBe(2);
  });
});

describe('computeSignalQuality — detectores', () => {
  it('detecta telemetry_gaps quando faltam fontes', () => {
    const out = runtimeSignalAdapter({ events: [mkEvent()] });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    expect(q.findings.some((f) => f.id === 'telemetry_gaps')).toBe(true);
  });

  it('detecta orphan_events', () => {
    const out = runtimeSignalAdapter({
      events: [mkEvent({ id: 'o1', session_id: null, user_id: null })],
    });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    expect(q.findings.some((f) => f.id === 'orphan_events')).toBe(true);
  });

  it('detecta broken_lineage', () => {
    const out = runtimeSignalAdapter({
      events: [mkEvent({ phase: 'phase2_service' })],
      incidents: [{ id: 'i1', severity: 'high', phase: 'phase_unknown' }],
    });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    expect(q.findings.some((f) => f.id === 'broken_lineage')).toBe(true);
  });

  it('detecta fragmented_runtime_visibility', () => {
    const out = runtimeSignalAdapter({ events: [mkEvent()] });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    expect(q.findings.some((f) => f.id === 'fragmented_runtime_visibility')).toBe(true);
  });

  it('detecta stale_operational_snapshot', () => {
    const out = runtimeSignalAdapter({
      releases: [{ id: 'r1', app_version: '1.0.0', captured_at: NOW - DAY * 30 }],
    });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    expect(q.findings.some((f) => f.id === 'stale_operational_snapshot')).toBe(true);
  });

  it('detecta missing_experiment_context', () => {
    const out = runtimeSignalAdapter({
      events: [mkEvent({ meta: { experiment_id: 'ghost-exp', app_version: '1.0.0' } })],
    });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    expect(q.findings.some((f) => f.id === 'missing_experiment_context')).toBe(true);
  });

  it('scores ficam entre 0 e 100', () => {
    const out = runtimeSignalAdapter({ events: [mkEvent()] });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    for (const v of Object.values(q.scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('dataset vazio devolve scores baixos mas válidos', () => {
    const out = runtimeSignalAdapter({});
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    expect(q.scores.forensic_completeness).toBe(0);
    expect(q.scores.operational_visibility).toBeGreaterThanOrEqual(0);
  });
});

describe('buildEvidenceFeed — feed cross-layer', () => {
  it('gera timeline ordenada', () => {
    const out = runtimeSignalAdapter({
      events: [mkEvent({ id: 'a', created_at: NOW }), mkEvent({ id: 'b', created_at: NOW + 1 })],
    });
    const feed = buildEvidenceFeed(out.normalizedSignals);
    expect(feed.timeline.length).toBe(2);
    expect(feed.timeline[0].signalId).toBe('a');
  });

  it('detecta contradição hardening_success com incident', () => {
    const out = runtimeSignalAdapter({
      hardening: [{ id: 'h1', session_id: 'S1', meta: { passed: true } }],
      incidents: [{ id: 'i1', session_id: 'S1', severity: 'high', phase: 'p' }],
    });
    const feed = buildEvidenceFeed(out.normalizedSignals);
    expect(feed.contradictions.length).toBeGreaterThan(0);
  });

  it('detecta confirmation multi-engine (≥3 sources)', () => {
    const out = runtimeSignalAdapter({
      events: [mkEvent({ session_id: 'S2' })],
      incidents: [{ id: 'i', session_id: 'S2', severity: 'high', phase: 'p' }],
      memory: [{ id: 'm', session_id: 'S2', type: 'pattern' }],
    });
    const feed = buildEvidenceFeed(out.normalizedSignals);
    expect(feed.confirmations.length).toBeGreaterThan(0);
    expect(feed.confirmations[0].enginesAgreeing).toBeGreaterThanOrEqual(3);
  });

  it('detecta cascade pattern', () => {
    const out = runtimeSignalAdapter({
      incidents: [
        { id: 'i1', session_id: 'S3', severity: 'high', phase: 'p', detected_at: NOW },
        { id: 'i2', session_id: 'S3', severity: 'high', phase: 'p', detected_at: NOW + 100 },
        { id: 'i3', session_id: 'S3', severity: 'high', phase: 'p', detected_at: NOW + 200 },
      ],
    });
    const feed = buildEvidenceFeed(out.normalizedSignals);
    expect(feed.hiddenPatterns.some((p) => p.id === 'cascade')).toBe(true);
  });

  it('detecta release_regression', () => {
    const out = runtimeSignalAdapter({
      releases: [{ id: 'r1', app_version: '2.0', captured_at: NOW }],
      incidents: [
        { id: 'i1', severity: 'high', phase: 'p', detected_at: NOW + HOUR },
        { id: 'i2', severity: 'high', phase: 'p', detected_at: NOW + HOUR * 2 },
      ],
    });
    const feed = buildEvidenceFeed(out.normalizedSignals);
    expect(feed.hiddenPatterns.some((p) => p.id === 'release_regression')).toBe(true);
  });

  it('detecta experiment_collision', () => {
    const out = runtimeSignalAdapter({
      experiments: [
        { id: 'e1', status: 'running', target_phase: 'phase2_service' },
        { id: 'e2', status: 'running', target_phase: 'phase2_service' },
      ],
    });
    const feed = buildEvidenceFeed(out.normalizedSignals);
    expect(feed.hiddenPatterns.some((p) => p.id === 'experiment_collision')).toBe(true);
  });
});

describe('reconstructOperationalSession — forensic', () => {
  it('reconstrói timeline da sessão', () => {
    const out = runtimeSignalAdapter({
      events: [
        mkEvent({ id: 'e1', session_id: 'X', created_at: NOW }),
        mkEvent({ id: 'e2', session_id: 'X', created_at: NOW + 100 }),
        mkEvent({ id: 'e3', session_id: 'Y', created_at: NOW + 200 }),
      ],
    });
    const r = reconstructOperationalSession(out.normalizedSignals, 'X');
    expect(r.reconstructedTimeline).toHaveLength(2);
    expect(r.sessionId).toBe('X');
  });

  it('detecta hidden transitions (gaps grandes entre phases)', () => {
    const out = runtimeSignalAdapter({
      events: [
        mkEvent({ id: 'a', session_id: 'X', phase: 'p1', created_at: NOW }),
        mkEvent({ id: 'b', session_id: 'X', phase: 'p2', created_at: NOW + HOUR }),
      ],
    });
    const r = reconstructOperationalSession(out.normalizedSignals, 'X');
    expect(r.hiddenTransitions.length).toBe(1);
    expect(r.hiddenTransitions[0].from).toBe('p1');
  });

  it('classifica failures prováveis', () => {
    const out = runtimeSignalAdapter({
      events: [mkEvent({ id: 'err', session_id: 'X', event: 'error' })],
    });
    const r = reconstructOperationalSession(out.normalizedSignals, 'X');
    expect(r.probableFailures).toContain('err');
  });

  it('session inexistente devolve confidence/integrity 0', () => {
    const out = runtimeSignalAdapter({ events: [mkEvent({ session_id: 'A' })] });
    const r = reconstructOperationalSession(out.normalizedSignals, 'ZZ');
    expect(r.confidence).toBe(0);
    expect(r.integrityScore).toBe(0);
  });
});

describe('computeSystemicCoverage — mapa de cobertura', () => {
  it('classifica weak vs covered', () => {
    const out = runtimeSignalAdapter({
      events: Array.from({ length: 5 }, (_, i) => mkEvent({ id: `e${i}` })),
      incidents: [{ id: 'i1', severity: 'high', phase: 'p' }],
    });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    const cov = computeSystemicCoverage(out.normalizedSignals, out, q);
    expect(cov.coveredAreas).toContain('onboarding_events');
    expect(cov.weakSignals).toContain('onboarding_incidents');
  });

  it('observabilityScore entre 0-100', () => {
    const out = runtimeSignalAdapter({ events: [mkEvent()] });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    const cov = computeSystemicCoverage(out.normalizedSignals, out, q);
    expect(cov.observabilityScore).toBeGreaterThanOrEqual(0);
    expect(cov.observabilityScore).toBeLessThanOrEqual(100);
  });

  it('detecta unstableZones por phase com erros', () => {
    const out = runtimeSignalAdapter({
      events: [
        mkEvent({ id: 'a', phase: 'risky', event: 'error' }),
        mkEvent({ id: 'b', phase: 'risky', event: 'error' }),
        mkEvent({ id: 'c', phase: 'safe', event: 'next' }),
      ],
      incidents: [{ id: 'i1', severity: 'high', phase: 'risky' }],
    });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    const cov = computeSystemicCoverage(out.normalizedSignals, out, q);
    expect(cov.unstableZones).toContain('risky');
  });

  it('blindSpots reflete missingSignals do adapter', () => {
    const out = runtimeSignalAdapter({ events: [mkEvent()] });
    const q = computeSignalQuality(out.normalizedSignals, out, { now: NOW });
    const cov = computeSystemicCoverage(out.normalizedSignals, out, q);
    expect(cov.blindSpots).toEqual(out.missingSignals);
  });
});

describe('determinismo e fail-soft', () => {
  it('mesma entrada → mesmo output (estrutura)', () => {
    const inp = { events: [mkEvent({ id: 'fixed', created_at: NOW })] };
    const a = runtimeSignalAdapter(inp);
    const b = runtimeSignalAdapter(inp);
    expect(a.normalizedSignals.length).toBe(b.normalizedSignals.length);
    expect(a.signalCoverage).toBe(b.signalCoverage);
  });

  it('feed em dataset vazio é estruturalmente vazio', () => {
    const out = runtimeSignalAdapter({});
    const feed = buildEvidenceFeed(out.normalizedSignals);
    expect(feed.timeline).toEqual([]);
    expect(feed.clusters).toEqual([]);
    expect(feed.contradictions).toEqual([]);
  });
});
