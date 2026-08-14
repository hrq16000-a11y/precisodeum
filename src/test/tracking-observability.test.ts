/**
 * Fase A · itens 1, 2 e 4 — testes do wrapper de tracking, das chaves de
 * idempotência e da severidade exibida no painel admin.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackingDedupeKey,
  claimLocalDedupe,
  stableHash,
  DEDUPE_WINDOW_MINUTES,
  __resetLocalDedupe,
} from '@/lib/tracking/dedupeKey';
import { shouldSample, SUCCESS_SAMPLE_RATE } from '@/lib/tracking/safeRpc';
import { severityOf, ERROR_RATE_ALERT_PCT } from '@/pages/admin/AdminTrackingHealthPage';

beforeEach(() => {
  __resetLocalDedupe();
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    /* jsdom sem storage */
  }
});

describe('trackingDedupeKey', () => {
  it('é determinística dentro da mesma janela', () => {
    const t = 1_700_000_000_000;
    const a = trackingDedupeKey('impression', ['sp-1', 'home-banner', '/'], t);
    const b = trackingDedupeKey('impression', ['sp-1', 'home-banner', '/'], t + 60_000);
    expect(a).toBe(b);
  });

  it('muda quando a janela vira', () => {
    const t = 1_700_000_000_000;
    const later = t + DEDUPE_WINDOW_MINUTES.impression * 60_000 * 2;
    expect(trackingDedupeKey('impression', ['sp-1'], t)).not.toBe(
      trackingDedupeKey('impression', ['sp-1'], later),
    );
  });

  it('separa tipos de evento', () => {
    const t = 1_700_000_000_000;
    expect(trackingDedupeKey('impression', ['x'], t)).not.toBe(
      trackingDedupeKey('click', ['x'], t),
    );
  });

  it('normaliza caixa e espaços das partes', () => {
    const t = 1_700_000_000_000;
    expect(trackingDedupeKey('funnel', [' Curitiba '], t)).toBe(
      trackingDedupeKey('funnel', ['curitiba'], t),
    );
  });

  it('janelas seguem o contrato do plano', () => {
    expect(DEDUPE_WINDOW_MINUTES).toEqual({
      impression: 30,
      click: 5,
      search_intent: 10,
      funnel: 10,
    });
  });

  it('stableHash é estável e curto', () => {
    expect(stableHash('abc')).toBe(stableHash('abc'));
    expect(stableHash('abc')).not.toBe(stableHash('abd'));
  });
});

describe('claimLocalDedupe', () => {
  it('permite a primeira ocorrência e bloqueia as repetições (re-render/StrictMode)', () => {
    const key = 'impression:abc';
    expect(claimLocalDedupe(key)).toBe(true);
    expect(claimLocalDedupe(key)).toBe(false);
    expect(claimLocalDedupe(key)).toBe(false);
  });

  it('bloqueia após refresh usando sessionStorage', () => {
    const key = 'click:xyz';
    expect(claimLocalDedupe(key)).toBe(true);
    __resetLocalDedupe(); // simula novo carregamento da página
    expect(claimLocalDedupe(key)).toBe(false);
  });

  it('chaves distintas não interferem', () => {
    expect(claimLocalDedupe('funnel:a')).toBe(true);
    expect(claimLocalDedupe('funnel:b')).toBe(true);
  });
});

describe('amostragem do reporte de saúde', () => {
  it('reporta 100% dos erros', () => {
    expect(shouldSample(false, 0.999999)).toBe(true);
    expect(shouldSample(false, 0)).toBe(true);
  });

  it('reporta apenas uma fração dos sucessos', () => {
    expect(shouldSample(true, SUCCESS_SAMPLE_RATE - 0.001)).toBe(true);
    expect(shouldSample(true, SUCCESS_SAMPLE_RATE + 0.001)).toBe(false);
  });
});

describe('severidade no painel admin', () => {
  it('42501 sempre é crítico', () => {
    expect(severityOf({ error_rate: 0, permission_denied: 1 })).toBe('critical');
  });

  it('taxa acima do limiar é atenção', () => {
    expect(severityOf({ error_rate: ERROR_RATE_ALERT_PCT, permission_denied: 0 })).toBe(
      'warning',
    );
  });

  it('operação saudável é ok', () => {
    expect(severityOf({ error_rate: 0.4, permission_denied: 0 })).toBe('ok');
  });
});
