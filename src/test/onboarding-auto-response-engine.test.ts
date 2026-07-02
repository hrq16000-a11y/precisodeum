import { describe, it, expect } from 'vitest';
import {
  evaluateSignal,
  evaluateBatch,
  shouldAutoResolve,
  deriveActions,
  stateForSeverity,
  normalizeSeverity,
  DEFAULT_DEBOUNCE_MINUTES,
} from '@/lib/onboarding/autoResponseEngine';

const NOW = new Date('2026-05-26T12:00:00Z');

const mkSignal = (overrides: Partial<Parameters<typeof evaluateSignal>[0]> = {}) => ({
  metric: 'autosave_remote_failed_rate',
  severity: 'high' as const,
  current_value: 0.42,
  baseline_value: 0.05,
  threshold_value: 0.2,
  app_version: '1.1.0',
  release_channel: 'production',
  detected_at: NOW,
  ...overrides,
});

describe('normalizeSeverity', () => {
  it('aceita os 4 valores válidos', () => {
    expect(normalizeSeverity('low')).toBe('low');
    expect(normalizeSeverity('medium')).toBe('medium');
    expect(normalizeSeverity('high')).toBe('high');
    expect(normalizeSeverity('critical')).toBe('critical');
  });
  it('faz fallback para medium em qualquer outro valor', () => {
    expect(normalizeSeverity(null)).toBe('medium');
    expect(normalizeSeverity(undefined)).toBe('medium');
    expect(normalizeSeverity('explodiu')).toBe('medium');
    expect(normalizeSeverity(7 as unknown as string)).toBe('medium');
  });
});

describe('stateForSeverity', () => {
  it('high/critical → incident', () => {
    expect(stateForSeverity('high')).toBe('incident');
    expect(stateForSeverity('critical')).toBe('incident');
  });
  it('low/medium → degraded', () => {
    expect(stateForSeverity('low')).toBe('degraded');
    expect(stateForSeverity('medium')).toBe('degraded');
  });
});

describe('deriveActions', () => {
  it('autosave_remote_failed → desliga draft remoto', () => {
    const a = deriveActions('autosave_remote_failed_rate', 'high');
    expect(a).toEqual([
      { flag: 'onboarding_remote_draft_enabled', to: false, reason: 'autosave_remote_collapse' },
    ]);
  });
  it('recovery_corruption → desliga recovery remoto', () => {
    const a = deriveActions('recovery_corrupt_payload', 'medium');
    expect(a[0].flag).toBe('onboarding_remote_recovery_enabled');
    expect(a[0].to).toBe(false);
  });
  it('refresh_spike → liga autosave local boost', () => {
    const a = deriveActions('refresh_spike_rate', 'medium');
    expect(a[0]).toEqual({
      flag: 'onboarding_local_autosave_boost',
      to: true,
      reason: 'refresh_spike',
    });
  });
  it('completion collapse só age em high/critical', () => {
    expect(deriveActions('completion_rate_drop', 'medium')).toEqual([]);
    expect(deriveActions('completion_rate_drop', 'critical')[0].flag).toBe(
      'onboarding_recovery_modal_enabled',
    );
  });
  it('métrica desconhecida → sem ações (sem ação destrutiva por padrão)', () => {
    expect(deriveActions('cosmic_rays', 'critical')).toEqual([]);
  });
});

describe('evaluateSignal · circuit breaker global', () => {
  it('flag OFF → skip:disabled (não abre incidente)', () => {
    const d = evaluateSignal(mkSignal(), [], { enabled: false, now: NOW });
    expect(d.kind).toBe('skip');
    if (d.kind === 'skip') expect(d.reason).toBe('disabled');
  });

  it('flag ON sem incidente prévio → open com ações corretas', () => {
    const d = evaluateSignal(mkSignal(), [], { enabled: true, now: NOW });
    expect(d.kind).toBe('open');
    if (d.kind === 'open') {
      expect(d.severity).toBe('high');
      expect(d.state).toBe('incident');
      expect(d.actions[0].flag).toBe('onboarding_remote_draft_enabled');
      expect(d.app_version).toBe('1.1.0');
    }
  });
});

describe('evaluateSignal · debounce anti-loop', () => {
  it('incidente para mesma métrica dentro do debounce → skip:debounced', () => {
    const recentlyOpened = new Date(NOW.getTime() - 5 * 60_000);
    const d = evaluateSignal(
      mkSignal(),
      [
        {
          id: 'i1',
          trigger_metric: 'autosave_remote_failed_rate',
          opened_at: recentlyOpened,
          resolved_at: null,
        },
      ],
      { enabled: true, now: NOW },
    );
    expect(d.kind).toBe('skip');
    if (d.kind === 'skip') expect(d.reason).toBe('debounced');
  });

  it('incidente da mesma métrica fora do debounce → abre normalmente', () => {
    const old = new Date(NOW.getTime() - (DEFAULT_DEBOUNCE_MINUTES + 10) * 60_000);
    const d = evaluateSignal(
      mkSignal(),
      [{ id: 'i1', trigger_metric: 'autosave_remote_failed_rate', opened_at: old, resolved_at: null }],
      { enabled: true, now: NOW },
    );
    expect(d.kind).toBe('open');
  });

  it('incidente de OUTRA métrica não bloqueia', () => {
    const d = evaluateSignal(
      mkSignal({ metric: 'refresh_spike_rate' }),
      [
        {
          id: 'i1',
          trigger_metric: 'autosave_remote_failed_rate',
          opened_at: new Date(NOW.getTime() - 60_000),
          resolved_at: null,
        },
      ],
      { enabled: true, now: NOW },
    );
    expect(d.kind).toBe('open');
  });
});

describe('evaluateBatch · dedupe por métrica', () => {
  it('mesma métrica duas vezes no mesmo batch → 1 open + 1 duplicate', () => {
    const out = evaluateBatch(
      [mkSignal(), mkSignal()],
      [],
      { enabled: true, now: NOW },
    );
    expect(out[0].kind).toBe('open');
    expect(out[1].kind).toBe('skip');
    if (out[1].kind === 'skip') expect(out[1].reason).toBe('duplicate_metric');
  });

  it('métricas distintas no batch → ambos abrem', () => {
    const out = evaluateBatch(
      [mkSignal(), mkSignal({ metric: 'refresh_spike_rate', severity: 'medium' })],
      [],
      { enabled: true, now: NOW },
    );
    expect(out.filter((d) => d.kind === 'open')).toHaveLength(2);
  });
});

describe('shouldAutoResolve', () => {
  const openedLongAgo = new Date(NOW.getTime() - 90 * 60_000);
  const openedRecent = new Date(NOW.getTime() - 10 * 60_000);

  it('incidente novo (< auto-resolve window) NÃO resolve', () => {
    const ok = shouldAutoResolve(
      { id: 'i', trigger_metric: 'autosave_remote_failed_rate', opened_at: openedRecent, resolved_at: null },
      [],
      { now: NOW },
    );
    expect(ok).toBe(false);
  });

  it('incidente velho SEM regressões recentes → auto-resolve', () => {
    const ok = shouldAutoResolve(
      { id: 'i', trigger_metric: 'autosave_remote_failed_rate', opened_at: openedLongAgo, resolved_at: null },
      [{ metric: 'outra_coisa', at: NOW }],
      { now: NOW },
    );
    expect(ok).toBe(true);
  });

  it('incidente velho COM regressão recente da mesma métrica → mantém aberto', () => {
    const ok = shouldAutoResolve(
      { id: 'i', trigger_metric: 'autosave_remote_failed_rate', opened_at: openedLongAgo, resolved_at: null },
      [{ metric: 'autosave_remote_failed_rate', at: new Date(NOW.getTime() - 5 * 60_000) }],
      { now: NOW },
    );
    expect(ok).toBe(false);
  });

  it('incidente já resolvido nunca reabre/auto-resolve', () => {
    const ok = shouldAutoResolve(
      {
        id: 'i',
        trigger_metric: 'autosave_remote_failed_rate',
        opened_at: openedLongAgo,
        resolved_at: NOW,
      },
      [],
      { now: NOW },
    );
    expect(ok).toBe(false);
  });
});
