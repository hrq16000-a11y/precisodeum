/**
 * Testes do Business Impact Engine.
 * Cobre: conversion impact, ops cost, lead impact, trend, release impact,
 * experiment ROI, health score, summaries, edge cases / anti-falso-positivo.
 */
import { describe, it, expect } from 'vitest';
import {
  BASELINE_COMPLETION_RATE,
  MIN_SAMPLE_FOR_ESTIMATE,
  buildExecutiveSummary,
  classifyHealth,
  computeBusinessHealthScore,
  computeReleaseImpact,
  estimateConversionLoss,
  estimateExperimentRoi,
  estimateGrowthTrend,
  estimateLeadImpact,
  estimateOperationalCost,
  rankRiskyReleases,
  rankStableReleases,
  type FunnelSnapshot,
  type ReleaseSnapshot,
  type ExperimentSnapshot,
} from '@/lib/onboarding/businessImpact';

const baseFunnel = (over: Partial<FunnelSnapshot> = {}): FunnelSnapshot => ({
  enters: 200,
  completes: 130,
  abandons: 50,
  validation_failed: 5,
  autosave_failed: 2,
  recoveries: 4,
  refreshes: 8,
  window_hours: 24,
  ...over,
});

describe('classifyHealth', () => {
  it('classifica corretamente todas as bandas', () => {
    expect(classifyHealth(95)).toBe('excellent');
    expect(classifyHealth(75)).toBe('healthy');
    expect(classifyHealth(60)).toBe('warning');
    expect(classifyHealth(45)).toBe('degraded');
    expect(classifyHealth(20)).toBe('critical');
  });
});

describe('estimateConversionLoss', () => {
  it('retorna zero quando amostra insuficiente (anti-falso-positivo)', () => {
    const r = estimateConversionLoss({ current: baseFunnel({ enters: 10, completes: 2 }) });
    expect(r.sample_sufficient).toBe(false);
    expect(r.estimated_loss_pp).toBe(0);
    expect(r.estimated_users_lost).toBe(0);
  });

  it('calcula perda quando completion abaixo do baseline', () => {
    const current = baseFunnel({ enters: 1000, completes: 500 }); // 50% vs 65%
    const r = estimateConversionLoss({ current });
    expect(r.sample_sufficient).toBe(true);
    expect(r.estimated_loss_pp).toBeGreaterThan(10);
    expect(r.estimated_users_lost).toBeGreaterThan(100);
    expect(r.estimated_leads_lost).toBeGreaterThan(0);
  });

  it('não reporta perda quando completion acima do baseline', () => {
    const current = baseFunnel({ enters: 1000, completes: 800 });
    const r = estimateConversionLoss({ current });
    expect(r.estimated_loss_pp).toBe(0);
    expect(r.estimated_users_lost).toBe(0);
  });

  it('usa baseline customizado quando amostra suficiente', () => {
    const baseline = baseFunnel({ enters: 1000, completes: 900 }); // 90%
    const current = baseFunnel({ enters: 1000, completes: 700 });  // 70%
    const r = estimateConversionLoss({ current, baseline });
    expect(r.baseline_completion_rate).toBeCloseTo(0.9, 1);
    expect(r.estimated_loss_pp).toBeGreaterThan(15);
  });

  it('ignora baseline inválido (poucos enters) e cai no default', () => {
    const baseline = baseFunnel({ enters: 5, completes: 5 });
    const current = baseFunnel({ enters: 1000, completes: 500 });
    const r = estimateConversionLoss({ current, baseline });
    expect(r.baseline_completion_rate).toBeCloseTo(BASELINE_COMPLETION_RATE, 5);
  });
});

describe('estimateOperationalCost', () => {
  it('autosave_failed pesa mais que recoveries', () => {
    const a = estimateOperationalCost(baseFunnel({ autosave_failed: 100, recoveries: 0, validation_failed: 0, refreshes: 0 }));
    const b = estimateOperationalCost(baseFunnel({ autosave_failed: 0, recoveries: 100, validation_failed: 0, refreshes: 0 }));
    expect(a.cost_score).toBeGreaterThan(b.cost_score);
  });
  it('normaliza por window_hours', () => {
    const r1 = estimateOperationalCost(baseFunnel({ window_hours: 1, validation_failed: 10 }));
    const r24 = estimateOperationalCost(baseFunnel({ window_hours: 24, validation_failed: 10 }));
    expect(r1.validation_pressure).toBeGreaterThan(r24.validation_pressure);
  });
  it('clampa cost_score em 0..100', () => {
    const r = estimateOperationalCost(baseFunnel({ autosave_failed: 9999, window_hours: 1 }));
    expect(r.cost_score).toBeLessThanOrEqual(100);
    expect(r.cost_score).toBeGreaterThanOrEqual(0);
  });
});

describe('estimateLeadImpact', () => {
  it('calcula leads gerados e em risco', () => {
    const r = estimateLeadImpact(baseFunnel({ completes: 100, abandons: 200 }));
    expect(r.estimated_leads_generated).toBe(35);
    expect(r.estimated_leads_at_risk).toBe(35);
  });
});

describe('estimateGrowthTrend', () => {
  it('detecta UP quando current > previous', () => {
    const prev = baseFunnel({ enters: 1000, completes: 500 });
    const cur = baseFunnel({ enters: 1000, completes: 700 });
    const r = estimateGrowthTrend(cur, prev);
    expect(r.direction).toBe('up');
    expect(r.delta_pp).toBeGreaterThan(0);
  });
  it('detecta DOWN', () => {
    const prev = baseFunnel({ enters: 1000, completes: 700 });
    const cur = baseFunnel({ enters: 1000, completes: 500 });
    const r = estimateGrowthTrend(cur, prev);
    expect(r.direction).toBe('down');
  });
  it('retorna FLAT quando amostra insuficiente em alguma janela', () => {
    const r = estimateGrowthTrend(baseFunnel({ enters: 5 }), baseFunnel({ enters: 1000, completes: 500 }));
    expect(r.direction).toBe('flat');
    expect(r.sample_sufficient).toBe(false);
  });
});

describe('computeReleaseImpact + rankings', () => {
  const releases: ReleaseSnapshot[] = [
    { app_version: 'v1.0.0', unique_sessions: 500, completion_rate: 0.7, abandon_rate: 0.2, validation_fail_rate: 0.05, regressions_detected: 0 },
    { app_version: 'v1.1.0', unique_sessions: 500, completion_rate: 0.4, abandon_rate: 0.5, validation_fail_rate: 0.2, regressions_detected: 3 },
    { app_version: 'v1.2.0', unique_sessions: 10,  completion_rate: 0.1, abandon_rate: 0.9, validation_fail_rate: 0.5, regressions_detected: 5 },
  ];

  it('atribui risco maior à release mais quebrada', () => {
    const rows = computeReleaseImpact(releases);
    const r11 = rows.find((r) => r.app_version === 'v1.1.0')!;
    const r10 = rows.find((r) => r.app_version === 'v1.0.0')!;
    expect(r11.risk_score).toBeGreaterThan(r10.risk_score);
    expect(r11.risk_band).not.toBe('stable');
  });

  it('não estima users_lost com amostra insuficiente', () => {
    const rows = computeReleaseImpact(releases);
    const r12 = rows.find((r) => r.app_version === 'v1.2.0')!;
    expect(r12.estimated_users_lost).toBe(0);
  });

  it('rankRiskyReleases ordena por risco desc', () => {
    const ranked = rankRiskyReleases(computeReleaseImpact(releases), 2);
    expect(ranked[0].risk_score).toBeGreaterThanOrEqual(ranked[1].risk_score);
  });

  it('rankStableReleases ignora amostras pequenas', () => {
    const ranked = rankStableReleases(computeReleaseImpact(releases));
    expect(ranked.find((r) => r.app_version === 'v1.2.0')).toBeUndefined();
  });
});

describe('estimateExperimentRoi', () => {
  const make = (over: Partial<ExperimentSnapshot> = {}): ExperimentSnapshot => ({
    experiment_key: 'exp_a',
    status: 'running',
    control_completion_rate: 0.5,
    variant_completion_rate: 0.55,
    control_sessions: 600,
    variant_sessions: 600,
    ...over,
  });

  it('marca winner com uplift>=2pp e amostra alta', () => {
    const r = estimateExperimentRoi(make());
    expect(r.verdict).toBe('winner');
    expect(r.uplift_pp).toBeCloseTo(5, 0);
    expect(r.confidence_band).toBe('high');
  });

  it('marca loser quando variante pior', () => {
    const r = estimateExperimentRoi(make({ variant_completion_rate: 0.4 }));
    expect(r.verdict).toBe('loser');
  });

  it('marca inconclusive com amostra baixa', () => {
    const r = estimateExperimentRoi(make({ control_sessions: 50, variant_sessions: 50 }));
    expect(r.verdict).toBe('inconclusive');
  });

  it('marca risky quando auto_disabled', () => {
    const r = estimateExperimentRoi(make({ status: 'auto_disabled' }));
    expect(r.verdict).toBe('risky');
  });
});

describe('computeBusinessHealthScore', () => {
  it('retorna score alto para funil saudável', () => {
    const h = computeBusinessHealthScore({
      funnel: baseFunnel({ enters: 1000, completes: 700, abandons: 100, validation_failed: 0, autosave_failed: 0, recoveries: 10 }),
    });
    expect(h.score).toBeGreaterThanOrEqual(70);
    expect(['excellent', 'healthy']).toContain(h.band);
  });

  it('cai para warning/degraded com muito abandono e falhas', () => {
    const h = computeBusinessHealthScore({
      funnel: baseFunnel({ enters: 1000, completes: 200, abandons: 700, validation_failed: 200, autosave_failed: 100, recoveries: 5 }),
    });
    expect(h.score).toBeLessThan(60);
  });

  it('considera incidentes críticos abertos', () => {
    const healthy = computeBusinessHealthScore({ funnel: baseFunnel({ enters: 1000, completes: 700 }) });
    const withIncident = computeBusinessHealthScore({
      funnel: baseFunnel({ enters: 1000, completes: 700 }),
      incidents: [{ severity: 'critical', resolved: false, age_hours: 48 }],
    });
    expect(withIncident.score).toBeLessThan(healthy.score);
  });

  it('breakdown soma todas as dimensões esperadas', () => {
    const h = computeBusinessHealthScore({ funnel: baseFunnel({ enters: 1000, completes: 700 }) });
    expect(Object.keys(h.breakdown).sort()).toEqual([
      'abandonment_trend',
      'completion_stability',
      'experiment_health',
      'friction_severity',
      'incident_pressure',
      'recovery_reliability',
      'release_stability',
    ]);
  });
});

describe('buildExecutiveSummary', () => {
  it('produz summary com release instável e melhor experimento', () => {
    const funnel = baseFunnel({ enters: 1000, completes: 400 });
    const health = computeBusinessHealthScore({ funnel });
    const conv = estimateConversionLoss({ current: funnel });
    const releases = computeReleaseImpact([
      { app_version: 'v2.0.0', unique_sessions: 500, completion_rate: 0.3, abandon_rate: 0.6, validation_fail_rate: 0.2, regressions_detected: 2 },
    ]);
    const exps = [
      estimateExperimentRoi({ experiment_key: 'cta_v2', status: 'running', control_completion_rate: 0.5, variant_completion_rate: 0.58, control_sessions: 600, variant_sessions: 600 }),
    ];
    const s = buildExecutiveSummary({ health, conversion: conv, releases, experiments: exps });
    expect(s.most_unstable_release).toContain('v2.0.0');
    expect(s.best_experiment).toContain('cta_v2');
    expect(s.recoverable_leads_estimate).toBeGreaterThan(0);
    expect(s.notes.length).toBeGreaterThan(0);
  });

  it('summary degrada texto quando saúde crítica', () => {
    const funnel = baseFunnel({ enters: 1000, completes: 100, abandons: 800, validation_failed: 300, autosave_failed: 200 });
    const health = computeBusinessHealthScore({ funnel });
    const conv = estimateConversionLoss({ current: funnel });
    const s = buildExecutiveSummary({ health, conversion: conv, releases: [], experiments: [] });
    expect(s.highest_risk.toLowerCase()).toMatch(/crítica|degradado|perda/);
  });
});

describe('edge cases', () => {
  it('funnel zerado não quebra', () => {
    const r = estimateConversionLoss({ current: baseFunnel({ enters: 0, completes: 0, abandons: 0 }) });
    expect(r.sample_sufficient).toBe(false);
    expect(Number.isFinite(r.current_completion_rate)).toBe(true);
  });
  it('MIN_SAMPLE_FOR_ESTIMATE acima de 0', () => {
    expect(MIN_SAMPLE_FOR_ESTIMATE).toBeGreaterThan(0);
  });
});
