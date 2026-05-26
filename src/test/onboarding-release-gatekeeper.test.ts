/**
 * Onboarding Release Gatekeeper · testes determinísticos
 *
 * Espelham as regras de bloqueio/score em SQL (compute_onboarding_release_health).
 */
import { describe, it, expect } from 'vitest';
import {
  classifyHealth,
  computeHealthScore,
  compareSnapshots,
  detectCanaryDegradation,
  escalationEventName,
  RELEASE_THRESHOLDS,
  type ReleaseHealthInputs,
  type SnapshotLike,
} from '@/lib/onboarding/releaseGatekeeper';

const baseInputs = (): ReleaseHealthInputs => ({
  enters: 100,
  completes: 90,
  abandons: 5,
  refreshes: 2,
  autosave_fail: 0,
  recovery_corruption: 0,
  validation_fail: 0,
  zombie_timer: 0,
  open_regressions: 0,
  critical_regressions: 0,
  open_incidents: 0,
});

describe('classifyHealth', () => {
  it('classifica em SAFE/WARNING/DEGRADED/BLOCKED conforme thresholds', () => {
    expect(classifyHealth(95, false)).toBe('SAFE');
    expect(classifyHealth(80, false)).toBe('WARNING');
    expect(classifyHealth(65, false)).toBe('DEGRADED');
    expect(classifyHealth(40, false)).toBe('BLOCKED');
    expect(classifyHealth(90, true)).toBe('BLOCKED');
  });
});

describe('computeHealthScore', () => {
  it('release saudável → SAFE com score 100', () => {
    const r = computeHealthScore(baseInputs());
    expect(r.health_score).toBe(100);
    expect(r.classification).toBe('SAFE');
    expect(r.blocked).toBe(false);
    expect(r.block_reasons).toHaveLength(0);
  });

  it('completion baixo gera WARNING (sem bloqueio)', () => {
    const r = computeHealthScore({ ...baseInputs(), completes: 55, zombie_timer: 5 });
    expect(r.block_reasons.map((x) => x.code)).toContain('completion_low');
    expect(r.classification).toBe('WARNING');
    expect(r.blocked).toBe(false);
  });

  it('completion collapse bloqueia', () => {
    const r = computeHealthScore({ ...baseInputs(), completes: 30 });
    expect(r.block_reasons.map((x) => x.code)).toContain('completion_collapse');
    expect(r.classification).toBe('BLOCKED');
    expect(r.blocked).toBe(true);
  });

  it('autosave_fail >= 25 bloqueia; entre 10 e 24 só penaliza', () => {
    const warn = computeHealthScore({ ...baseInputs(), autosave_fail: 12 });
    expect(warn.blocked).toBe(false);
    expect(warn.block_reasons.map((x) => x.code)).toContain('autosave_fail_spike');

    const block = computeHealthScore({ ...baseInputs(), autosave_fail: 30 });
    expect(block.blocked).toBe(true);
    expect(block.classification).toBe('BLOCKED');
  });

  it('recovery_corruption >= 3 bloqueia sempre', () => {
    const r = computeHealthScore({ ...baseInputs(), recovery_corruption: 3 });
    expect(r.blocked).toBe(true);
    expect(r.block_reasons.map((x) => x.code)).toContain('recovery_corruption');
  });

  it('critical_regressions > 0 bloqueia', () => {
    const r = computeHealthScore({ ...baseInputs(), critical_regressions: 1 });
    expect(r.blocked).toBe(true);
    expect(r.block_reasons.map((x) => x.code)).toContain('critical_regressions_open');
  });

  it('incident aberto bloqueia', () => {
    const r = computeHealthScore({ ...baseInputs(), open_incidents: 1 });
    expect(r.blocked).toBe(true);
    expect(r.block_reasons.map((x) => x.code)).toContain('incident_open');
  });

  it('sample size pequeno NÃO bloqueia por completion (evita falso positivo)', () => {
    const r = computeHealthScore({
      ...baseInputs(),
      enters: 5,
      completes: 0,
      abandons: 5,
    });
    // sem penalidade de completion porque enters < MIN_SAMPLE_ENTERS
    expect(r.block_reasons.find((x) => x.code === 'completion_collapse')).toBeUndefined();
    expect(r.classification).toBe('SAFE');
  });

  it('respeita thresholds publicados', () => {
    expect(RELEASE_THRESHOLDS.MIN_SAMPLE_ENTERS).toBe(20);
    expect(RELEASE_THRESHOLDS.COMPLETION_COLLAPSE).toBe(40);
    expect(RELEASE_THRESHOLDS.AUTOSAVE_FAIL_BLOCK).toBe(25);
  });
});

describe('compareSnapshots', () => {
  it('calcula deltas corretamente', () => {
    const a: SnapshotLike = {
      health_score: 90,
      classification: 'SAFE',
      open_regressions: 0,
      critical_regressions: 0,
      open_incidents: 0,
      metrics: { completion_rate: 80, abandon_rate: 10, autosave_fail: 1, recovery_corruption: 0 },
    };
    const b: SnapshotLike = {
      health_score: 70,
      classification: 'WARNING',
      open_regressions: 2,
      critical_regressions: 1,
      open_incidents: 1,
      metrics: { completion_rate: 60, abandon_rate: 25, autosave_fail: 6, recovery_corruption: 1 },
    };
    const d = compareSnapshots(a, b);
    expect(d.health_score).toBe(-20);
    expect(d.completion_rate).toBe(-20);
    expect(d.critical_regressions).toBe(1);
    expect(d.recovery_corruption).toBe(1);
  });
});

describe('detectCanaryDegradation', () => {
  const baseline: SnapshotLike = {
    health_score: 95,
    classification: 'SAFE',
    open_regressions: 0,
    critical_regressions: 0,
    open_incidents: 0,
    metrics: { completion_rate: 85, abandon_rate: 5, autosave_fail: 0, recovery_corruption: 0 },
  };

  it('canary equivalente → safe', () => {
    const v = detectCanaryDegradation(baseline, { ...baseline });
    expect(v.kind).toBe('safe');
    expect(escalationEventName(v)).toBeNull();
  });

  it('queda de 6 pontos no health → warning', () => {
    const v = detectCanaryDegradation(baseline, { ...baseline, health_score: 89 });
    expect(v.kind).toBe('warning');
    expect(escalationEventName(v)).toBe('release_warning');
  });

  it('queda de 12 no health → degraded', () => {
    const v = detectCanaryDegradation(baseline, { ...baseline, health_score: 83 });
    expect(v.kind).toBe('degraded');
    expect(escalationEventName(v)).toBe('release_degraded');
  });

  it('critical regression nova bloqueia canary', () => {
    const v = detectCanaryDegradation(baseline, {
      ...baseline,
      critical_regressions: 1,
    });
    expect(v.kind).toBe('blocked');
    expect(escalationEventName(v)).toBe('release_blocked');
    if (v.kind !== 'safe') {
      expect(v.reasons.some((r) => r.startsWith('critical_regressions'))).toBe(true);
    }
  });

  it('completion -10pp bloqueia canary', () => {
    const v = detectCanaryDegradation(baseline, {
      ...baseline,
      metrics: { ...baseline.metrics, completion_rate: 70 },
    });
    expect(v.kind === 'blocked' || v.kind === 'degraded').toBe(true);
  });

  it('canary já BLOCKED é sempre blocked', () => {
    const v = detectCanaryDegradation(baseline, {
      ...baseline,
      classification: 'BLOCKED',
    });
    expect(v.kind).toBe('blocked');
  });
});
