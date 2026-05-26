/**
 * Onboarding Experimentation Framework · testes do engine puro
 */
import { describe, it, expect } from 'vitest';
import {
  assignVariant,
  bucketFor,
  computeVariantDelta,
  diffSnapshots,
  evaluateKillSwitch,
  fnv1a32,
  matchesAudience,
  pickVariant,
  validateExperimentDefinition,
  SAFE_EXPERIMENT_TYPES,
  type ExperimentDefinition,
  type VariantMetrics,
} from '@/lib/onboarding/experimentEngine';

const baseExp: ExperimentDefinition = {
  id: 'cta_wording_v1',
  type: 'cta_wording',
  status: 'running',
  rolloutPercentage: 100,
  variants: [
    { id: 'control', isControl: true, weight: 1 },
    { id: 'b', weight: 1 },
  ],
};

describe('fnv1a32 / bucketFor', () => {
  it('é determinístico para a mesma chave', () => {
    expect(fnv1a32('abc')).toBe(fnv1a32('abc'));
    expect(bucketFor('exp1', 'user-42')).toBe(bucketFor('exp1', 'user-42'));
  });
  it('produz buckets distintos para chaves distintas', () => {
    expect(bucketFor('exp1', 'a')).not.toBe(bucketFor('exp1', 'b'));
  });
  it('mantém bucket no range 0..9999', () => {
    for (let i = 0; i < 50; i++) {
      const b = bucketFor('exp', `u${i}`);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(10000);
    }
  });
});

describe('assignVariant (anti-flicker + rollout + audience)', () => {
  it('atribui a mesma variante em chamadas repetidas (anti-flicker)', () => {
    const a = assignVariant(baseExp, { unitId: 'user-1' });
    const b = assignVariant(baseExp, { unitId: 'user-1' });
    expect(a.variantId).toBe(b.variantId);
    expect(a.reason).toBe('assigned');
  });

  it('respeita rolloutPercentage = 0 → ninguém entra', () => {
    const exp = { ...baseExp, rolloutPercentage: 0 };
    for (let i = 0; i < 20; i++) {
      const r = assignVariant(exp, { unitId: `u${i}` });
      expect(r.variantId).toBeNull();
      expect(r.reason).toBe('rollout_excluded');
    }
  });

  it('rollout 50% deixa aproximadamente metade entrar (±15%)', () => {
    const exp = { ...baseExp, rolloutPercentage: 50 };
    let inside = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (assignVariant(exp, { unitId: `unit-${i}` }).variantId) inside++;
    }
    const ratio = inside / N;
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it('status != running bloqueia atribuição', () => {
    for (const s of ['draft', 'paused', 'auto_disabled', 'completed'] as const) {
      const r = assignVariant({ ...baseExp, status: s }, { unitId: 'x' });
      expect(r.variantId).toBeNull();
      expect(r.reason).toBe('not_running');
    }
  });

  it('audience filter exclui dispositivos errados', () => {
    const exp: ExperimentDefinition = { ...baseExp, audience: { device: 'mobile' } };
    const r = assignVariant(exp, { unitId: 'x', device: 'desktop' });
    expect(r.reason).toBe('audience_excluded');
    expect(r.variantId).toBeNull();
  });

  it('respeita startAt/endAt', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(assignVariant({ ...baseExp, startAt: future }, { unitId: 'x' }).reason).toBe('not_started');
    expect(assignVariant({ ...baseExp, endAt: past }, { unitId: 'x' }).reason).toBe('expired');
  });
});

describe('matchesAudience', () => {
  it('any/undefined sempre passa', () => {
    expect(matchesAudience(undefined, { unitId: 'x' })).toBe(true);
    expect(matchesAudience({ device: 'any', userType: 'any' }, { unitId: 'x' })).toBe(true);
  });
  it('filtra source/release/region', () => {
    expect(matchesAudience({ sources: ['gps'] }, { unitId: 'x', source: 'cep' })).toBe(false);
    expect(matchesAudience({ releases: ['1.0'] }, { unitId: 'x', release: '2.0' })).toBe(false);
    expect(matchesAudience({ regions: ['SP'] }, { unitId: 'x', region: 'RJ' })).toBe(false);
  });
});

describe('pickVariant weighting', () => {
  it('distribui ~proporcional ao weight', () => {
    const variants = [
      { id: 'a', weight: 1, isControl: true },
      { id: 'b', weight: 3 },
    ];
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) {
      const v = pickVariant(variants, i % 10000);
      counts[v!.id]++;
    }
    // b deve ter ~3x mais que a
    expect(counts.b / counts.a).toBeGreaterThan(2.3);
    expect(counts.b / counts.a).toBeLessThan(3.7);
  });
});

describe('validateExperimentDefinition (safety guard)', () => {
  it('aceita definição válida', () => {
    expect(validateExperimentDefinition(baseExp).ok).toBe(true);
  });
  it('rejeita tipo fora da whitelist', () => {
    const v = validateExperimentDefinition({ ...baseExp, type: 'persistence' as never });
    expect(v.ok).toBe(false);
    expect(v.errors).toContain('type_not_in_safe_whitelist');
    expect(v.errors).toContain('type_forbidden');
  });
  it('exige pelo menos 2 variantes e um control', () => {
    const v1 = validateExperimentDefinition({ ...baseExp, variants: [{ id: 'only' }] });
    expect(v1.errors).toContain('variants_min_2');
    const v2 = validateExperimentDefinition({
      ...baseExp,
      variants: [{ id: 'a' }, { id: 'b' }],
    });
    expect(v2.errors).toContain('control_required');
  });
  it('rejeita rollout fora de range', () => {
    expect(validateExperimentDefinition({ ...baseExp, rolloutPercentage: 150 }).errors).toContain(
      'rollout_out_of_range',
    );
  });
  it('cobre toda a whitelist segura', () => {
    for (const t of SAFE_EXPERIMENT_TYPES) {
      const v = validateExperimentDefinition({ ...baseExp, type: t });
      expect(v.ok).toBe(true);
    }
  });
});

const m = (over: Partial<VariantMetrics>): VariantMetrics => ({
  variantId: 'x',
  unitsAssigned: 1000,
  enters: 1000,
  completes: 500,
  abandons: 200,
  refreshes: 50,
  recoveries: 10,
  validationFailed: 20,
  rageClicks: 5,
  hesitations: 30,
  avgPhaseDurationMs: 12000,
  ...over,
});

describe('computeVariantDelta', () => {
  it('detecta variante vencedora', () => {
    const control = m({ variantId: 'control', completes: 500 });
    const variant = m({ variantId: 'b', completes: 600 });
    const d = computeVariantDelta(variant, control);
    expect(d.completionRatePp).toBeCloseTo(10, 0);
    expect(d.status).toBe('winning');
    expect(d.confidence).toBe('high');
  });
  it('detecta perdedora', () => {
    const control = m({ variantId: 'control', completes: 500 });
    const variant = m({ variantId: 'b', completes: 350, abandons: 350 });
    const d = computeVariantDelta(variant, control);
    expect(d.status).toBe('losing');
  });
  it('marca inconclusive com poucos dados', () => {
    const control = m({ variantId: 'control', unitsAssigned: 20, enters: 20 });
    const variant = m({ variantId: 'b', unitsAssigned: 20, enters: 20 });
    expect(computeVariantDelta(variant, control).confidence).toBe('low');
    expect(computeVariantDelta(variant, control).status).toBe('inconclusive');
  });
});

describe('evaluateKillSwitch', () => {
  it('não dispara com poucos dados', () => {
    const control = m({ variantId: 'control' });
    const variant = m({ variantId: 'b', unitsAssigned: 50 });
    const k = evaluateKillSwitch(variant, control);
    expect(k.shouldDisable).toBe(false);
    expect(k.reasons).toContain('insufficient_units');
  });
  it('dispara em completion collapse', () => {
    const control = m({ variantId: 'control', completes: 600 });
    const variant = m({ variantId: 'b', completes: 350 });
    const k = evaluateKillSwitch(variant, control);
    expect(k.shouldDisable).toBe(true);
    expect(k.reasons).toContain('completion_collapse');
  });
  it('dispara em abandonment spike', () => {
    const control = m({ variantId: 'control', abandons: 100 });
    const variant = m({ variantId: 'b', abandons: 350 });
    const k = evaluateKillSwitch(variant, control);
    expect(k.shouldDisable).toBe(true);
    expect(k.reasons).toContain('abandonment_spike');
  });
  it('dispara em validation explosion', () => {
    const control = m({ variantId: 'control', validationFailed: 10 });
    const variant = m({ variantId: 'b', validationFailed: 50 });
    const k = evaluateKillSwitch(variant, control);
    expect(k.reasons).toContain('validation_explosion');
  });
});

describe('diffSnapshots', () => {
  it('calcula delta de enters/completes e pp', () => {
    const before = {
      capturedAt: '2026-01-01T00:00:00Z',
      rolloutReached: 10,
      variants: [m({ variantId: 'control', enters: 100, completes: 40 })],
    };
    const after = {
      capturedAt: '2026-01-02T00:00:00Z',
      rolloutReached: 50,
      variants: [m({ variantId: 'control', enters: 300, completes: 150 })],
    };
    const [d] = diffSnapshots(before, after);
    expect(d.enters).toBe(200);
    expect(d.completes).toBe(110);
    // 50% vs 40% = +10pp
    expect(d.completionRatePp).toBeCloseTo(10, 1);
  });
});
