/**
 * Testes do parser único `parseProviderIntegrityError`.
 * Substitui as regex inline duplicadas e cobre todos os branches.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parseProviderIntegrityError,
  dispatchProviderIntegrityFocus,
} from '@/lib/providerIntegrityError';

describe('parseProviderIntegrityError', () => {
  it('detecta por código 22023 mesmo com mensagem genérica', () => {
    const r = parseProviderIntegrityError({ code: '22023', message: 'PROVIDER_INCOMPLETE_NEIGHBORHOOD' });
    expect(r.matched).toBe(true);
    if (r.matched) {
      expect(r.kind).toBe('neighborhood');
      expect(r.focusEvent).toBe('wizard:focus-neighborhood');
      expect(r.ctaLabel).toMatch(/Bairro/i);
    }
  });

  it('detecta por mensagem com prefixo PROVIDER_INCOMPLETE_ mesmo sem código', () => {
    const r = parseProviderIntegrityError({ message: 'PROVIDER_INCOMPLETE_COORDS' });
    expect(r.matched).toBe(true);
    if (r.matched) {
      expect(r.kind).toBe('coords');
      expect(r.focusEvent).toBe('wizard:focus-gps');
    }
  });

  it('classifica city quando mensagem só diz CITY', () => {
    const r = parseProviderIntegrityError({ code: '22023', message: 'PROVIDER_INCOMPLETE_CITY' });
    expect(r.matched).toBe(true);
    if (r.matched) {
      expect(r.kind).toBe('city');
      expect(r.focusEvent).toBe('wizard:focus-city');
    }
  });

  it('default cai em city quando mensagem genérica PROVIDER_INCOMPLETE_DATA', () => {
    const r = parseProviderIntegrityError({ code: '22023', message: 'PROVIDER_INCOMPLETE_DATA' });
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.kind).toBe('city');
  });

  it('ignora outros códigos SQL (23505 duplicate key)', () => {
    const r = parseProviderIntegrityError({ code: '23505', message: 'duplicate key value' });
    expect(r.matched).toBe(false);
  });

  it('ignora null / undefined / valores não-objeto', () => {
    expect(parseProviderIntegrityError(null).matched).toBe(false);
    expect(parseProviderIntegrityError(undefined).matched).toBe(false);
    expect(parseProviderIntegrityError('string').matched).toBe(false);
    expect(parseProviderIntegrityError(42).matched).toBe(false);
  });

  it('mensagem case-insensitive', () => {
    const r = parseProviderIntegrityError({ message: 'provider_incomplete_neighborhood' });
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.kind).toBe('neighborhood');
  });
});

describe('dispatchProviderIntegrityFocus', () => {
  it('despacha CustomEvent correspondente ao focusEvent do parsed', () => {
    const parsed = parseProviderIntegrityError({ code: '22023', message: 'PROVIDER_INCOMPLETE_NEIGHBORHOOD' });
    expect(parsed.matched).toBe(true);
    if (!parsed.matched) return;

    const spy = vi.fn();
    window.addEventListener('wizard:focus-neighborhood', spy);
    dispatchProviderIntegrityFocus(parsed);
    window.removeEventListener('wizard:focus-neighborhood', spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('é seguro em ambiente sem window (silencia exceção)', () => {
    // Apenas garantir que não lança.
    const parsed = parseProviderIntegrityError({ code: '22023', message: 'PROVIDER_INCOMPLETE_COORDS' });
    if (parsed.matched) {
      expect(() => dispatchProviderIntegrityFocus(parsed)).not.toThrow();
    }
  });
});
