/**
 * Operational Memory · tests (puro, determinístico, sem IO)
 */
import { describe, expect, it } from 'vitest';
import {
  buildCausalLineage,
  buildFailureMemory,
  buildHistoricalTimeline,
  buildIncidentFingerprint,
  buildKnowledgeGraph,
  buildOperationalMemoryReport,
  classifyFailureFamily,
  computeBlastRadiusHistory,
  computeFailureRecurrenceProbability,
  computeMemoryScores,
  computeOperationalReputation,
  computePhaseReliabilityHistory,
  computeRuntimeStabilityTrend,
  correlateHistoricalIncidents,
  detectChronicHotspots,
  detectConfidenceEvolution,
  detectHistoricalRegressionSimilarity,
  detectKnownBrokenFlows,
  detectMitigationEffectiveness,
  detectOperationalPatternDrift,
  detectRecurringPatterns,
  detectReleaseInstability,
  detectStabilityDecay,
  detectTrustDecay,
  generateOperationalKnowledgeSummary,
  MIN_SAMPLE_FOR_INFERENCE,
  OPERATIONAL_MEMORY_POLICY,
  type HistoricalIncident,
  type IncidentDetectorKind,
  type MitigationRecord,
  type Severity,
} from '@/lib/onboarding/operationalMemory';

let _i = 0;
const BASE_NOW = Date.now();
function mk(
  detector: IncidentDetectorKind,
  opts: Partial<HistoricalIncident> = {},
): HistoricalIncident {
  _i++;
  return {
    id: opts.id ?? `inc${_i}`,
    detector,
    phase: opts.phase ?? 'phase2_service',
    transition: opts.transition ?? null,
    retry_pattern: opts.retry_pattern ?? 'none',
    recovery_pattern: opts.recovery_pattern ?? 'none',
    release: opts.release ?? '1.0.0',
    device_class: opts.device_class ?? 'mobile',
    timing_bucket: opts.timing_bucket ?? 'medium',
    severity: opts.severity ?? 'high',
    divergence_chain: opts.divergence_chain ?? ['ui_completion', 'no_provider'],
    occurred_at: opts.occurred_at ?? new Date(BASE_NOW - (1000 - _i) * 1000).toISOString(),
    mitigation_id: opts.mitigation_id ?? null,
  };
}

describe('OPERATIONAL_MEMORY_POLICY', () => {
  it('é frozen e somente leitura', () => {
    expect(Object.isFrozen(OPERATIONAL_MEMORY_POLICY)).toBe(true);
    expect(OPERATIONAL_MEMORY_POLICY.allow_ai).toBe(false);
    expect(OPERATIONAL_MEMORY_POLICY.allow_embeddings).toBe(false);
    expect(OPERATIONAL_MEMORY_POLICY.allow_vector_db).toBe(false);
    expect(OPERATIONAL_MEMORY_POLICY.allow_pii_capture).toBe(false);
  });
});

describe('fingerprint + family', () => {
  it('fingerprint é determinístico para inputs equivalentes', () => {
    const a = buildIncidentFingerprint(mk('phantom_success', { id: 'a' }));
    const b = buildIncidentFingerprint(mk('phantom_success', { id: 'b' }));
    expect(a.hash).toBe(b.hash);
    expect(a.family).toBe('integrity_family');
  });
  it('fingerprint muda quando detector/phase/divergence muda', () => {
    const a = buildIncidentFingerprint(mk('phantom_success', { id: 'a' }));
    const b = buildIncidentFingerprint(mk('zombie_draft', { id: 'b', phase: 'phase4_avatar' }));
    expect(a.hash).not.toBe(b.hash);
    expect(b.family).toBe('recovery_family');
  });
  it('fingerprint NÃO inclui release (permite match cross-release)', () => {
    const a = buildIncidentFingerprint(mk('phantom_success', { id: 'a', release: '1.0.0' }));
    const b = buildIncidentFingerprint(mk('phantom_success', { id: 'b', release: '2.0.0' }));
    expect(a.hash).toBe(b.hash);
  });
  it('classifyFailureFamily mapeia todos os detectores conhecidos', () => {
    const detectors: IncidentDetectorKind[] = [
      'phantom_success', 'partial_persistence', 'zombie_draft', 'hidden_loop',
      'retry_storm', 'dead_navigation', 'toast_vs_reality', 'ui_vs_backend_divergence',
      'impossible_state', 'session_fragmentation', 'recovery_integrity_failure',
      'persistence_failure', 'completion_collapse', 'autosave_failure', 'corruption',
      'release_regression', 'behavioral_friction',
    ];
    for (const d of detectors) expect(classifyFailureFamily(d)).toBeDefined();
  });
});

describe('correlateHistoricalIncidents', () => {
  it('encontra similares por Jaccard ≥ threshold', () => {
    const target = mk('phantom_success', { id: 't' });
    const history = [
      mk('phantom_success', { id: 'h1' }),
      mk('phantom_success', { id: 'h2', phase: 'phase4_avatar' }),
      mk('dead_navigation', { id: 'h3' }),
    ];
    const sims = correlateHistoricalIncidents(target, history, { minSim: 0.5 });
    expect(sims.length).toBeGreaterThan(0);
    expect(sims[0].id).toBe('h1');
  });
});

describe('detectHistoricalRegressionSimilarity', () => {
  it('flagra reincidência quando 3+ históricos parecidos', () => {
    const target = mk('phantom_success', { id: 't' });
    const history = [mk('phantom_success', { id: 'h1' }), mk('phantom_success', { id: 'h2' }), mk('phantom_success', { id: 'h3' })];
    expect(detectHistoricalRegressionSimilarity(target, history, 0.7)).toBe(true);
  });
});

describe('detectRecurringPatterns', () => {
  it('agrega fingerprint repetido com low-sample guard', () => {
    const h = [mk('zombie_draft'), mk('zombie_draft'), mk('zombie_draft')];
    const r = detectRecurringPatterns(h, { minCount: MIN_SAMPLE_FOR_INFERENCE, windowDays: 10_000 });
    expect(r).toHaveLength(1);
    expect(r[0].count).toBe(3);
  });
  it('descarta padrão raro', () => {
    const h = [mk('zombie_draft')];
    const r = detectRecurringPatterns(h, { windowDays: 10_000 });
    expect(r).toHaveLength(0);
  });
});

describe('detectChronicHotspots', () => {
  it('flagra fase com 2x média', () => {
    const h = [
      mk('phantom_success', { phase: 'hot' }),
      mk('phantom_success', { phase: 'hot' }),
      mk('phantom_success', { phase: 'hot' }),
      mk('dead_navigation', { phase: 'cool' }),
    ];
    const out = detectChronicHotspots(h);
    expect(out[0].phase).toBe('hot');
  });
  it('low-sample guard com history vazio', () => {
    expect(detectChronicHotspots([])).toHaveLength(0);
  });
});

describe('detectReleaseInstability', () => {
  it('flagra release com ratio alto', () => {
    const h = [
      mk('phantom_success', { release: '2.0' }),
      mk('phantom_success', { release: '2.0' }),
      mk('phantom_success', { release: '2.0' }),
      mk('phantom_success', { release: '2.0' }),
      mk('phantom_success', { release: '1.0' }),
    ];
    const out = detectReleaseInstability(h);
    expect(out.some((r) => r.release === '2.0')).toBe(true);
  });
});

describe('detectMitigationEffectiveness', () => {
  it('mede redução pós-mitigação', () => {
    const t = new Date(2026, 1, 15, 12).toISOString();
    const before = Array.from({ length: 5 }, (_, i) =>
      mk('persistence_failure', { id: `b${i}`, occurred_at: new Date(2026, 1, 10 + (i % 2), 10).toISOString() }));
    const after = Array.from({ length: 1 }, () =>
      mk('persistence_failure', { id: 'a1', occurred_at: new Date(2026, 1, 20, 10).toISOString() }));
    const m: MitigationRecord = { id: 'M1', applied_at: t, targets: ['persistence_family'] };
    const eff = detectMitigationEffectiveness([...before, ...after], m);
    expect(eff.enough_sample).toBe(true);
    expect(eff.reduction_pct).toBeGreaterThan(0);
  });
  it('low-sample guard', () => {
    const m: MitigationRecord = { id: 'M2', applied_at: new Date(2026, 1, 1).toISOString(), targets: ['recovery_family'] };
    const eff = detectMitigationEffectiveness([], m);
    expect(eff.enough_sample).toBe(false);
    expect(eff.reduction_pct).toBe(0);
  });
});

describe('drift / decay / trust / stability', () => {
  it('detectOperationalPatternDrift low-sample retorna 0', () => {
    const d = detectOperationalPatternDrift([]);
    expect(d.enough_sample).toBe(false);
    expect(d.drift).toBe(0);
  });
  it('detectStabilityDecay flagra aumento recente', () => {
    const now = Date.now();
    const recent = Array.from({ length: 10 }, (_, i) =>
      mk('phantom_success', { id: `r${i}`, occurred_at: new Date(now - i * 86_400_000 / 2).toISOString() }));
    const old = Array.from({ length: 2 }, (_, i) =>
      mk('phantom_success', { id: `o${i}`, occurred_at: new Date(now - (15 + i) * 86_400_000).toISOString() }));
    const out = detectStabilityDecay([...recent, ...old], { now });
    expect(out.decaying).toBe(true);
  });
  it('detectTrustDecay degrada quando estabilidade cai', () => {
    const now = Date.now();
    const recent = Array.from({ length: 12 }, (_, i) =>
      mk('phantom_success', { id: `r${i}`, occurred_at: new Date(now - i * 86_400_000 / 2).toISOString() }));
    const out = detectTrustDecay([...recent], { windowDays: 7 });
    expect(out.trust_score).toBeLessThanOrEqual(100);
    expect(out.degraded).toBe(true);
  });
  it('computeRuntimeStabilityTrend devolve insufficient sem dados', () => {
    expect(computeRuntimeStabilityTrend([]).trend).toBe('insufficient');
  });
});

describe('confidence evolution + blast radius', () => {
  it('confidence baixa quando muitos críticos recentes', () => {
    const now = Date.now();
    const h = Array.from({ length: 5 }, (_, i) =>
      mk('phantom_success', { id: `c${i}`, severity: 'critical' as Severity, occurred_at: new Date(now - i * 86_400_000 / 2).toISOString() }));
    const ev = detectConfidenceEvolution(h, { now });
    expect(ev[ev.length - 1].confidence).toBeLessThan(100);
  });
  it('blast radius history retorna pontos por release', () => {
    const h = [mk('phantom_success', { release: '1.0' }), mk('zombie_draft', { release: '1.0' }), mk('phantom_success', { release: '2.0' })];
    const out = computeBlastRadiusHistory(h);
    expect(out.length).toBe(2);
  });
});

describe('reputation / reliability / recurrence probability', () => {
  it('reputation degrada com críticos', () => {
    const clean = computeOperationalReputation([]);
    const dirty = computeOperationalReputation(Array.from({ length: 5 }, () => mk('phantom_success', { severity: 'critical' })));
    expect(clean).toBe(100);
    expect(dirty).toBeLessThan(50);
  });
  it('phase reliability por fase', () => {
    const out = computePhaseReliabilityHistory([mk('phantom_success', { phase: 'A' }), mk('zombie_draft', { phase: 'B', severity: 'low' })]);
    expect(out.A).toBeLessThan(100);
    expect(out.B).toBeGreaterThan(out.A);
  });
  it('recurrence probability respeita low-sample', () => {
    const probs = computeFailureRecurrenceProbability([mk('phantom_success')]);
    expect(probs[0].enough_sample).toBe(false);
    expect(probs[0].probability).toBe(0);
  });
});

describe('lineage / broken flows', () => {
  it('detectKnownBrokenFlows agrega phase+family com severidade alta', () => {
    const h = [
      mk('persistence_failure', { phase: 'photos', severity: 'high' }),
      mk('persistence_failure', { phase: 'photos', severity: 'critical' }),
      mk('persistence_failure', { phase: 'photos', severity: 'high' }),
    ];
    expect(detectKnownBrokenFlows(h)[0].phase).toBe('photos');
  });
});

describe('knowledge graph + lineage + timeline', () => {
  it('graph tem nodes por incident/fingerprint/family/detector', () => {
    const g = buildKnowledgeGraph([mk('phantom_success', { mitigation_id: 'mit-1' })]);
    expect(g.nodes.some((n) => n.kind === 'fingerprint')).toBe(true);
    expect(g.nodes.some((n) => n.kind === 'family')).toBe(true);
    expect(g.nodes.some((n) => n.kind === 'mitigation')).toBe(true);
    expect(g.edges.some((e) => e.kind === 'mitigated_by')).toBe(true);
  });
  it('causal lineage encontra similar_prev cronologicamente', () => {
    const h = [mk('phantom_success', { id: 'p1' }), mk('phantom_success', { id: 'p2' }), mk('phantom_success', { id: 'p3' })];
    const lin = buildCausalLineage(h);
    expect(lin[2].similar_prev?.length).toBeGreaterThan(0);
  });
  it('timeline ordena por dia', () => {
    const h = [
      mk('phantom_success', { occurred_at: '2026-01-02T10:00:00.000Z' }),
      mk('phantom_success', { occurred_at: '2026-01-01T10:00:00.000Z' }),
    ];
    const tl = buildHistoricalTimeline(h);
    expect(tl[0].date < tl[1].date).toBe(true);
  });
});

describe('failure memory + scores agregados', () => {
  it('failure memory agrega por fingerprint', () => {
    const fm = buildFailureMemory([mk('phantom_success'), mk('phantom_success'), mk('zombie_draft', { phase: 'photos' })]);
    expect(fm[0].recurrence_count).toBe(2);
  });
  it('computeMemoryScores 100 quando sem incidentes', () => {
    const s = computeMemoryScores([]);
    expect(s.operational_reputation).toBe(100);
    expect(s.persistence_reliability).toBe(100);
  });
  it('computeMemoryScores degrada com incidentes críticos', () => {
    const s = computeMemoryScores(Array.from({ length: 4 }, () => mk('persistence_failure', { severity: 'critical' })));
    expect(s.persistence_reliability).toBeLessThan(70);
  });
});

describe('summary determinístico', () => {
  it('gera linhas baseadas em recurring/hotspot/release/decay', () => {
    const h = [
      mk('phantom_success', { phase: 'hot', release: '2.0' }),
      mk('phantom_success', { phase: 'hot', release: '2.0' }),
      mk('phantom_success', { phase: 'hot', release: '2.0' }),
      mk('phantom_success', { phase: 'hot', release: '2.0' }),
      mk('dead_navigation', { phase: 'cool', release: '1.0' }),
    ];
    const out = generateOperationalKnowledgeSummary(h);
    expect(out.some((l) => l.kind === 'recurrence')).toBe(true);
    expect(out.some((l) => l.kind === 'hotspot')).toBe(true);
  });
  it('summary vazio quando history vazio', () => {
    expect(generateOperationalKnowledgeSummary([])).toEqual([]);
  });
});

describe('buildOperationalMemoryReport (E2E)', () => {
  it('produz report consistente com scores+recurring+graph+summary', () => {
    const h = [
      mk('phantom_success', { phase: 'photos', release: '2.0' }),
      mk('phantom_success', { phase: 'photos', release: '2.0' }),
      mk('phantom_success', { phase: 'photos', release: '2.0' }),
      mk('zombie_draft', { phase: 'service', release: '1.0' }),
    ];
    const r = buildOperationalMemoryReport(h);
    expect(r.recurring.length).toBeGreaterThan(0);
    expect(r.graph.nodes.length).toBeGreaterThan(0);
    expect(r.scores.operational_reputation).toBeLessThan(100);
    expect(r.summary.length).toBeGreaterThan(0);
    expect(r.failure_memory.length).toBeGreaterThan(0);
  });
});
