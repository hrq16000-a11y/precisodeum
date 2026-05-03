/**
 * Regressão wizardErrorCodes — códigos canônicos.
 *
 * Trava os valores literais usados em logs/telemetria/error_reports para que
 * agrupamentos no painel de suporte não quebrem com renomeações silenciosas.
 */
import { describe, it, expect } from 'vitest';
import {
  WIZARD_ERROR_CODES,
  phase2PhotosBlockCode,
  recoverBackoffDelayMs,
  RECOVER_BACKOFF_DELAYS_MS,
  RECOVER_MAX_ATTEMPTS,
} from '@/lib/wizardErrorCodes';

describe('WIZARD_ERROR_CODES', () => {
  it('mantém códigos exatos esperados', () => {
    expect(WIZARD_ERROR_CODES.PHASE2_PHOTOS_NO_SERVICE).toBe('phase2_photos:no_service');
    expect(WIZARD_ERROR_CODES.PHASE2_PHOTOS_NO_SESSION).toBe('phase2_photos:no_session');
    expect(WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_ATTEMPT).toBe('phase2_photos:recover_attempt');
    expect(WIZARD_ERROR_CODES.PHASE2_PHOTOS_RECOVER_AUTO).toBe('phase2_photos:recover_auto');
  });

  it('phase2PhotosBlockCode mapeia razão para código canônico', () => {
    expect(phase2PhotosBlockCode('no_service')).toBe('phase2_photos:no_service');
    expect(phase2PhotosBlockCode('no_session')).toBe('phase2_photos:no_session');
  });
});

describe('recoverBackoffDelayMs (jitter ±25%)', () => {
  it('tentativa 0 sempre retorna 0 (sem jitter — UX instantânea)', () => {
    for (let i = 0; i < 20; i++) expect(recoverBackoffDelayMs(0)).toBe(0);
  });

  it('mantém base em ±25% para tentativas > 0', () => {
    for (let attempt = 1; attempt < RECOVER_MAX_ATTEMPTS; attempt++) {
      const base = RECOVER_BACKOFF_DELAYS_MS[attempt];
      for (let i = 0; i < 50; i++) {
        const v = recoverBackoffDelayMs(attempt);
        expect(v).toBeGreaterThanOrEqual(Math.floor(base * 0.75));
        expect(v).toBeLessThanOrEqual(Math.ceil(base * 1.25));
      }
    }
  });

  it('produz variação (não é constante) — quebra colisão', () => {
    const samples = new Set<number>();
    for (let i = 0; i < 30; i++) samples.add(recoverBackoffDelayMs(1));
    expect(samples.size).toBeGreaterThan(1);
  });
});

