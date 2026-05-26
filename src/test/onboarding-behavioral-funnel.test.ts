/**
 * Behavioral Funnel · testes determinísticos
 *
 * Sem rede. Sem PII. Cobre:
 *  - hesitation, rage, repeated, multi-submit, rapid-return
 *  - sanitize anti-vazamento
 *  - throttle
 *  - friction score + hotspot ranking
 *  - abandonment chain parsing + top patterns
 *  - segment aggregation
 *  - ux impact simulation
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateBySegment,
  computeFrictionScore,
  createThrottleState,
  detectHesitation,
  detectIdlePause,
  detectMultiAttemptSubmit,
  detectRageClick,
  detectRapidPhaseReturn,
  detectRepeatedValidationError,
  parseAbandonmentChains,
  rankHotspots,
  sanitizeBehavioralMeta,
  shouldEmitBehavioral,
  simulateUxImpact,
  topAbandonmentPatterns,
} from '@/lib/onboarding/behavioralFunnel';
import { trackBehavioral } from '@/lib/onboarding/behavioralTelemetry';

describe('detectors', () => {
  it('hesitation: tempo >= 8s', () => {
    expect(detectHesitation(7_999)).toBe(false);
    expect(detectHesitation(8_000)).toBe(true);
  });
  it('idle pause: >=30s', () => {
    expect(detectIdlePause(29_000)).toBe(false);
    expect(detectIdlePause(30_000)).toBe(true);
  });
  it('rage click: >=3 cliques em <=1s', () => {
    expect(detectRageClick([100, 300, 500])).toBe(true);
    expect(detectRageClick([100, 300])).toBe(false);
    expect(detectRageClick([100, 600, 1_500])).toBe(false);
  });
  it('repeated validation: >=3 tentativas', () => {
    expect(detectRepeatedValidationError(2)).toBe(false);
    expect(detectRepeatedValidationError(3)).toBe(true);
  });
  it('rapid return: voltou em <=4s', () => {
    expect(detectRapidPhaseReturn(1_000, 4_500)).toBe(true);
    expect(detectRapidPhaseReturn(1_000, 6_000)).toBe(false);
  });
  it('multi-submit: 3 cliques em <=5s', () => {
    expect(detectMultiAttemptSubmit([0, 1_000, 2_000])).toBe(true);
    expect(detectMultiAttemptSubmit([0, 6_000, 7_000])).toBe(false);
  });
});

describe('sanitizeBehavioralMeta · anti-leak', () => {
  it('remove chaves sensíveis (cpf/email/whatsapp/password/address)', () => {
    const out = sanitizeBehavioralMeta({
      cpf: '12345678900',
      email: 'a@b.com',
      whatsapp: '11999999999',
      password: 'segredo',
      address: 'Rua X',
      cep: '01000000',
      name: 'João',
      phase: 'phase2_service',
      ms: 1234,
    });
    expect(out).toEqual({ phase: 'phase2_service', ms: 1234 });
    expect(out.cpf).toBeUndefined();
    expect(out.email).toBeUndefined();
  });

  it('aceita field só com nome whitelisted, normaliza lowercase', () => {
    const out = sanitizeBehavioralMeta({ field: 'WHATSAPP' });
    expect(out.field).toBe('whatsapp');
  });

  it('descarta field fora da whitelist (poderia ser conteúdo)', () => {
    const out = sanitizeBehavioralMeta({ field: 'cartao_credito_4111' });
    expect(out.field).toBeUndefined();
  });

  it('descarta strings muito longas (anti-blob)', () => {
    const out = sanitizeBehavioralMeta({ note: 'x'.repeat(200) });
    expect(out.note).toBeUndefined();
  });

  it('input nulo retorna objeto vazio', () => {
    expect(sanitizeBehavioralMeta(null)).toEqual({});
    expect(sanitizeBehavioralMeta(undefined)).toEqual({});
  });
});

describe('throttle', () => {
  it('respeita janela mínima por chave', () => {
    const s = createThrottleState();
    expect(shouldEmitBehavioral(s, 'k', 0, 2_000)).toBe(true);
    expect(shouldEmitBehavioral(s, 'k', 500, 2_000)).toBe(false);
    expect(shouldEmitBehavioral(s, 'k', 2_500, 2_000)).toBe(true);
    expect(shouldEmitBehavioral(s, 'outra', 600, 2_000)).toBe(true);
  });

  it('trackBehavioral rejeita evento fora do catálogo', async () => {
    const ok = await trackBehavioral({ event: 'evento_inexistente' as any });
    expect(ok).toBe(false);
  });

  it('trackBehavioral aplica throttle deterministicamente', async () => {
    const state = createThrottleState();
    const a = await trackBehavioral({ event: 'field_focus', field: 'whatsapp', throttleState: state, now: 0 });
    const b = await trackBehavioral({ event: 'field_focus', field: 'whatsapp', throttleState: state, now: 500 });
    expect(a).toBe(true);
    expect(b).toBe(false);
  });
});

describe('computeFrictionScore', () => {
  it('release saudável → low', () => {
    const r = computeFrictionScore({
      enters: 100, abandons: 5, refreshes: 1, hesitations: 2,
      rage_clicks: 0, repeated_validations: 0, back_buttons: 1, multi_submits: 0, avg_time_ms: 5_000,
    });
    expect(r.level).toBe('low');
    expect(r.score).toBeLessThan(25);
  });

  it('alto atrito → critical, drivers ordenados', () => {
    const r = computeFrictionScore({
      enters: 100, abandons: 60, refreshes: 30, hesitations: 80,
      rage_clicks: 50, repeated_validations: 70, back_buttons: 40, multi_submits: 40, avg_time_ms: 60_000,
    });
    expect(r.level).toBe('critical');
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.drivers[0].weight).toBeGreaterThanOrEqual(r.drivers[r.drivers.length - 1].weight);
  });
});

describe('rankHotspots', () => {
  it('ordena por friction score desc e ignora amostra pequena', () => {
    const ranked = rankHotspots([
      { key: 'phase_a', enters: 100, abandons: 50, hesitations: 60, rage_clicks: 20, repeated_validations: 30 },
      { key: 'phase_b', enters: 100, abandons: 5,  hesitations: 2,  rage_clicks: 0,  repeated_validations: 0 },
      { key: 'phase_c', enters: 3,   abandons: 3,  hesitations: 3,  rage_clicks: 3,  repeated_validations: 3 },
    ]);
    expect(ranked.length).toBe(2);
    expect(ranked[0].key).toBe('phase_a');
    expect(ranked[1].key).toBe('phase_b');
  });
});

describe('parseAbandonmentChains + topAbandonmentPatterns', () => {
  it('identifica sessões sem complete e captura últimos 3 eventos', () => {
    const events = [
      { session_id: 's1', event: 'enter', created_at: '2026-01-01T00:00:00Z', meta: { phase: 'phase2_service' } },
      { session_id: 's1', event: 'hesitation_detected', created_at: '2026-01-01T00:00:10Z', meta: { phase: 'phase2_service' } },
      { session_id: 's1', event: 'abandon', created_at: '2026-01-01T00:00:30Z', meta: { phase: 'phase2_service' } },
      { session_id: 's2', event: 'enter', created_at: '2026-01-01T00:00:00Z', meta: { phase: 'phase3_photos' } },
      { session_id: 's2', event: 'complete', created_at: '2026-01-01T00:01:00Z', meta: { phase: 'phase3_photos' } },
    ];
    const chains = parseAbandonmentChains(events);
    expect(chains).toHaveLength(1);
    expect(chains[0].session_id).toBe('s1');
    expect(chains[0].exit_phase).toBe('phase2_service');
    expect(chains[0].last_3).toContain('abandon');

    const top = topAbandonmentPatterns(chains, 5);
    expect(top[0].count).toBe(1);
    expect(top[0].pattern).toContain('abandon');
  });
});

describe('aggregateBySegment', () => {
  it('agrupa por device e calcula completion + friction', () => {
    const events = [
      { event: 'enter', meta: { device: 'mobile' } },
      { event: 'enter', meta: { device: 'mobile' } },
      { event: 'complete', meta: { device: 'mobile' } },
      { event: 'enter', meta: { device: 'desktop' } },
      { event: 'complete', meta: { device: 'desktop' } },
      { event: 'hesitation_detected', meta: { device: 'mobile' } },
      { event: 'rage_click_detected', meta: { device: 'mobile' } },
    ];
    const seg = aggregateBySegment(events, 'device');
    const mobile = seg.find((s) => s.segment === 'mobile')!;
    const desktop = seg.find((s) => s.segment === 'desktop')!;
    expect(mobile.enters).toBe(2);
    expect(mobile.completion_rate).toBe(50);
    expect(desktop.completion_rate).toBe(100);
    expect(mobile.friction_score).toBeGreaterThanOrEqual(0);
  });
});

describe('simulateUxImpact', () => {
  it('reduzir atrito eleva completion estimado, capado em 100', () => {
    const r = simulateUxImpact({
      current_completion_rate: 60,
      current_friction_score: 50,
      friction_reduction_pct: 50,
    });
    expect(r.estimated_lift_pp).toBeGreaterThan(0);
    expect(r.estimated_completion_rate).toBeLessThanOrEqual(100);
    expect(r.confidence).toBe('high');
  });
  it('atrito baixo → confiança low', () => {
    const r = simulateUxImpact({
      current_completion_rate: 90, current_friction_score: 10, friction_reduction_pct: 50,
    });
    expect(r.confidence).toBe('low');
  });
  it('gap até 100 limita o lift', () => {
    const r = simulateUxImpact({
      current_completion_rate: 99, current_friction_score: 100, friction_reduction_pct: 100,
    });
    expect(r.estimated_completion_rate).toBeLessThanOrEqual(100);
    expect(r.estimated_lift_pp).toBeLessThanOrEqual(1);
  });
});
