/**
 * Tests · Runtime Governance Signals & Drift Intelligence.
 *
 * Cobre os 10 cenários exigidos:
 *  1. runtime usage aggregation
 *  2. dead flag detection
 *  3. orphan rpc detection
 *  4. stale threshold detection
 *  5. telemetry degradation (drop entre janelas)
 *  6. runtime blast radius (frequência observada)
 *  7. coverage gaps map
 *  8. decay detection (stale/decaying/abandoned)
 *  9. signal health scoring + buckets
 * 10. silent failure pattern + degraded latency
 *
 * Tudo isolado, sem Supabase, com tempo determinístico.
 */
import { describe, it, expect } from 'vitest';
import type { GovernanceItem } from '@/lib/onboarding/governanceRegistry';
import {
  aggregateRuntimeSnapshot,
  buildCoverageMap,
  buildGovernanceTimeline,
  classifyDecay,
  computeRuntimeBlastRadius,
  computeSignalHealthScore,
  detectRuntimeDrifts,
  RUNTIME_GOVERNANCE_POLICY,
  type RuntimeEvent,
  type RuntimeUsageSnapshot,
} from '@/lib/onboarding/runtimeGovernance';

const NOW = new Date('2026-05-26T12:00:00Z').getTime();
const DAY = 86_400_000;

function item(partial: Partial<GovernanceItem> & Pick<GovernanceItem, 'id' | 'kind'>): GovernanceItem {
  return {
    title: partial.id,
    owner: 'test',
    version: '1.0.0',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    lifecycle: 'active',
    risk_level: 'medium',
    dependencies: [],
    consumers: [],
    description: 'test item',
    ...partial,
  } as GovernanceItem;
}

describe('runtimeGovernance · aggregation', () => {
  it('agrega contagens, sessões, erro e latência média dentro da janela', () => {
    const events: RuntimeEvent[] = [
      { item_id: 'rpc.a', ts: NOW - 1 * DAY, session_id: 's1', latency_ms: 100 },
      { item_id: 'rpc.a', ts: NOW - 2 * DAY, session_id: 's2', latency_ms: 300, is_error: true },
      { item_id: 'rpc.a', ts: NOW - 30 * DAY, session_id: 's3', latency_ms: 999 }, // fora da janela
      { item_id: 'rpc.b', ts: NOW - 5 * DAY, session_id: 's1' },
    ];
    const snaps = aggregateRuntimeSnapshot(events, { now: NOW, window_days: 14 });
    const a = snaps.get('rpc.a')!;
    expect(a.execution_count).toBe(2);
    expect(a.unique_sessions).toBe(2);
    expect(a.error_rate).toBeCloseTo(0.5, 5);
    expect(a.avg_latency_ms).toBe(200);
    expect(a.last_used_at).toBe(new Date(NOW - 1 * DAY).toISOString());
    expect(snaps.get('rpc.b')!.execution_count).toBe(1);
  });

  it('snapshot vazio quando não há eventos na janela', () => {
    const snaps = aggregateRuntimeSnapshot([{ item_id: 'x', ts: NOW - 90 * DAY }], { now: NOW, window_days: 14 });
    expect(snaps.size).toBe(0);
  });
});

describe('runtimeGovernance · drift intelligence', () => {
  const items: GovernanceItem[] = [
    item({ id: 'flag.dead', kind: 'feature_flag' }),
    item({ id: 'rpc.orphan', kind: 'rpc' }),
    item({ id: 'rpc.alive', kind: 'rpc' }),
    item({ id: 'thr.stale', kind: 'threshold' }),
    item({ id: 'eng.unused', kind: 'engine' }),
    item({ id: 'tel.metric', kind: 'telemetry_contract' }),
    item({ id: 'dash.empty', kind: 'dashboard' }),
    item({ id: 'exp.zombie', kind: 'experiment_constraint' }),
  ];
  const snapshots = new Map<string, RuntimeUsageSnapshot>([
    ['rpc.alive', { item_id: 'rpc.alive', execution_count: 50, unique_sessions: 10, error_rate: 0, avg_latency_ms: 80, last_used_at: new Date(NOW).toISOString() }],
  ]);

  it('detecta dead_flag, orphan_rpc, stale_threshold, unused_engine, dead_metric, dashboard_without_data, zombie_experiment', () => {
    const alerts = detectRuntimeDrifts(items, snapshots);
    const kinds = alerts.map((a) => a.kind).sort();
    expect(kinds).toEqual([
      'dashboard_without_data',
      'dead_flag',
      'dead_metric',
      'orphan_rpc',
      'stale_threshold',
      'unused_engine',
      'zombie_experiment',
    ]);
    // rpc.alive não dispara
    expect(alerts.find((a) => a.item_id === 'rpc.alive')).toBeUndefined();
  });

  it('ignora itens archived/experimental', () => {
    const archived = [item({ id: 'rpc.old', kind: 'rpc', lifecycle: 'archived' })];
    expect(detectRuntimeDrifts(archived, new Map())).toEqual([]);
  });

  it('telemetry_drop dispara quando uso cai ≥ ratio entre janelas', () => {
    const it1 = [item({ id: 'tel.x', kind: 'telemetry_contract' })];
    const prev = new Map<string, RuntimeUsageSnapshot>([
      ['tel.x', { item_id: 'tel.x', execution_count: 100, unique_sessions: 20, error_rate: 0, avg_latency_ms: 0, last_used_at: new Date(NOW - 10 * DAY).toISOString() }],
    ]);
    const cur = new Map<string, RuntimeUsageSnapshot>([
      ['tel.x', { item_id: 'tel.x', execution_count: 20, unique_sessions: 5, error_rate: 0, avg_latency_ms: 0, last_used_at: new Date(NOW).toISOString() }],
    ]);
    const alerts = detectRuntimeDrifts(it1, cur, { previous_snapshot: prev });
    expect(alerts.find((a) => a.kind === 'telemetry_drop')).toBeDefined();
  });

  it('silent_failure_pattern para RPC com error_rate alto', () => {
    const items2 = [item({ id: 'rpc.flaky', kind: 'rpc' })];
    const snap = new Map<string, RuntimeUsageSnapshot>([
      ['rpc.flaky', { item_id: 'rpc.flaky', execution_count: 50, unique_sessions: 10, error_rate: 0.6, avg_latency_ms: 50, last_used_at: new Date(NOW).toISOString() }],
    ]);
    const alerts = detectRuntimeDrifts(items2, snap);
    const silent = alerts.find((a) => a.kind === 'silent_failure_pattern');
    expect(silent).toBeDefined();
    expect(silent!.severity).toBe('critical');
  });

  it('degraded_signal_quality para latência alta em RPC', () => {
    const items2 = [item({ id: 'rpc.slow', kind: 'rpc' })];
    const snap = new Map<string, RuntimeUsageSnapshot>([
      ['rpc.slow', { item_id: 'rpc.slow', execution_count: 30, unique_sessions: 10, error_rate: 0, avg_latency_ms: 4000, last_used_at: new Date(NOW).toISOString() }],
    ]);
    const alerts = detectRuntimeDrifts(items2, snap);
    const deg = alerts.find((a) => a.kind === 'degraded_signal_quality');
    expect(deg).toBeDefined();
    expect(deg!.severity).toBe('high');
  });

  it('degraded_signal_quality em telemetria com poucas sessões', () => {
    const items2 = [item({ id: 'tel.low', kind: 'telemetry_contract' })];
    const snap = new Map<string, RuntimeUsageSnapshot>([
      ['tel.low', { item_id: 'tel.low', execution_count: 20, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: new Date(NOW).toISOString() }],
    ]);
    const alerts = detectRuntimeDrifts(items2, snap, { min_sessions_for_signal: 3 });
    expect(alerts.find((a) => a.kind === 'degraded_signal_quality')).toBeDefined();
  });
});

describe('runtimeGovernance · blast radius observado', () => {
  it('rankeia consumidores por execuções reais e calcula share', () => {
    const items: GovernanceItem[] = [
      item({ id: 'engine.core', kind: 'engine' }),
      item({ id: 'rpc.heavy', kind: 'rpc', dependencies: ['engine.core'] }),
      item({ id: 'rpc.light', kind: 'rpc', dependencies: ['engine.core'] }),
      item({ id: 'rpc.unrelated', kind: 'rpc' }),
    ];
    const snaps = new Map<string, RuntimeUsageSnapshot>([
      ['engine.core', { item_id: 'engine.core', execution_count: 100, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: null }],
      ['rpc.heavy', { item_id: 'rpc.heavy', execution_count: 90, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: null }],
      ['rpc.light', { item_id: 'rpc.light', execution_count: 10, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: null }],
    ]);
    const r = computeRuntimeBlastRadius('engine.core', items, snaps);
    expect(r.affected).toHaveLength(2);
    expect(r.affected[0].consumer_id).toBe('rpc.heavy');
    expect(r.affected[0].share_pct).toBe(90);
    expect(r.affected[0].severity).toBe('critical');
    expect(r.affected[1].consumer_id).toBe('rpc.light');
    expect(r.summary).toContain('90');
  });

  it('retorna summary informativo quando não há consumidores observados', () => {
    const items: GovernanceItem[] = [item({ id: 'engine.solo', kind: 'engine' })];
    const r = computeRuntimeBlastRadius('engine.solo', items, new Map());
    expect(r.affected).toEqual([]);
    expect(r.summary.toLowerCase()).toContain('nenhum');
  });
});

describe('runtimeGovernance · coverage map', () => {
  it('classifica blind items por kind e ordena por menor cobertura', () => {
    const items: GovernanceItem[] = [
      item({ id: 'rpc.a', kind: 'rpc' }),
      item({ id: 'rpc.b', kind: 'rpc' }),
      item({ id: 'tel.a', kind: 'telemetry_contract' }),
      item({ id: 'tel.b', kind: 'telemetry_contract' }),
    ];
    const snaps = new Map<string, RuntimeUsageSnapshot>([
      ['rpc.a', { item_id: 'rpc.a', execution_count: 10, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: null }],
      ['rpc.b', { item_id: 'rpc.b', execution_count: 5, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: null }],
    ]);
    const report = buildCoverageMap(items, snaps);
    const tel = report.entries.find((e) => e.kind === 'telemetry_contract')!;
    const rpc = report.entries.find((e) => e.kind === 'rpc')!;
    expect(tel.coverage_pct).toBe(0);
    expect(tel.blind_items).toEqual(['tel.a', 'tel.b']);
    expect(rpc.coverage_pct).toBe(100);
    expect(report.overall_coverage_pct).toBe(50);
    expect(report.entries[0].kind).toBe('telemetry_contract'); // menor cobertura primeiro
  });
});

describe('runtimeGovernance · decay classification', () => {
  it('classifica fresh/stale/decaying/abandoned por dias sem uso', () => {
    const items: GovernanceItem[] = [
      item({ id: 'a.fresh', kind: 'rpc' }),
      item({ id: 'a.stale', kind: 'rpc' }),
      item({ id: 'a.decaying', kind: 'rpc' }),
      item({ id: 'a.abandoned', kind: 'rpc' }),
      item({ id: 'a.never', kind: 'rpc' }),
    ];
    const snaps = new Map<string, RuntimeUsageSnapshot>([
      ['a.fresh', { item_id: 'a.fresh', execution_count: 1, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: new Date(NOW - 2 * DAY).toISOString() }],
      ['a.stale', { item_id: 'a.stale', execution_count: 1, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: new Date(NOW - 35 * DAY).toISOString() }],
      ['a.decaying', { item_id: 'a.decaying', execution_count: 1, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: new Date(NOW - 70 * DAY).toISOString() }],
      ['a.abandoned', { item_id: 'a.abandoned', execution_count: 1, unique_sessions: 1, error_rate: 0, avg_latency_ms: 0, last_used_at: new Date(NOW - 120 * DAY).toISOString() }],
    ]);
    const out = classifyDecay(items, snaps, { now: NOW });
    const get = (id: string) => out.find((d) => d.item_id === id)!;
    expect(get('a.fresh').state).toBe('fresh');
    expect(get('a.stale').state).toBe('stale');
    expect(get('a.decaying').state).toBe('decaying');
    expect(get('a.abandoned').state).toBe('abandoned');
    expect(get('a.never').state).toBe('abandoned');
    expect(get('a.never').days_since_use).toBeNull();
  });
});

describe('runtimeGovernance · signal health score', () => {
  it('produz score por categoria + overall + bucket coerente', () => {
    const items: GovernanceItem[] = [
      item({ id: 'tel.live', kind: 'telemetry_contract' }),
      item({ id: 'tel.dead', kind: 'telemetry_contract' }),
      item({ id: 'rpc.ok', kind: 'rpc' }),
    ];
    const snaps = new Map<string, RuntimeUsageSnapshot>([
      ['tel.live', { item_id: 'tel.live', execution_count: 30, unique_sessions: 10, error_rate: 0, avg_latency_ms: 0, last_used_at: new Date(NOW).toISOString() }],
      ['rpc.ok', { item_id: 'rpc.ok', execution_count: 30, unique_sessions: 10, error_rate: 0, avg_latency_ms: 50, last_used_at: new Date(NOW).toISOString() }],
    ]);
    const drifts = detectRuntimeDrifts(items, snaps);
    const report = computeSignalHealthScore(items, snaps, drifts);
    const tel = report.categories.find((c) => c.category === 'telemetry')!;
    const rpc = report.categories.find((c) => c.category === 'rpc')!;
    expect(rpc.score).toBe(100);
    expect(rpc.bucket).toBe('healthy');
    expect(tel.score).toBeLessThan(100);
    expect(['warning', 'degraded', 'critical', 'healthy']).toContain(tel.bucket);
    expect(report.overall_bucket).toBeDefined();
  });
});

describe('runtimeGovernance · timeline + policy guard', () => {
  it('monta timeline ordenada com markers opcionais', () => {
    const it1 = item({ id: 'engine.x', kind: 'engine', created_at: '2026-01-01T00:00:00Z' });
    const snap: RuntimeUsageSnapshot = {
      item_id: 'engine.x',
      execution_count: 10,
      unique_sessions: 3,
      error_rate: 0,
      avg_latency_ms: 0,
      last_used_at: '2026-05-20T00:00:00Z',
    };
    const tl = buildGovernanceTimeline(it1, snap, {
      last_incident_at: '2026-03-10T00:00:00Z',
      last_regression_at: '2026-04-01T00:00:00Z',
    });
    expect(tl[0].kind).toBe('created');
    expect(tl[tl.length - 1].kind).toBe('last_execution');
    expect(tl.map((e) => e.kind)).toContain('last_incident');
    expect(tl.map((e) => e.kind)).toContain('last_regression');
  });

  it('policy guard congelado: read-only, sem side effects', () => {
    expect(RUNTIME_GOVERNANCE_POLICY.read_only).toBe(true);
    expect(RUNTIME_GOVERNANCE_POLICY.side_effects).toBe('none');
    expect(() => {
      // @ts-expect-error policy is frozen
      RUNTIME_GOVERNANCE_POLICY.read_only = false;
    }).toThrow();
    expect(RUNTIME_GOVERNANCE_POLICY.forbidden_actions).toContain('auto_delete');
    expect(RUNTIME_GOVERNANCE_POLICY.forbidden_actions).toContain('auto_disable');
  });
});
