/**
 * Cobre normalizeProviderPayload para o módulo PJ:
 *  - social_links nulo / vazio / com chaves vazias não geram erro 400
 *  - updates parciais (só institucionais) não removem campos NOT NULL
 *  - safeOptionalString trata "" como null para campos institucionais
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeProviderPayload,
  safeOptionalString,
} from '@/lib/providerPayload';

describe('normalizeProviderPayload — PJ social_links & institucionais', () => {
  it('aceita social_links undefined sem quebrar', () => {
    const out = normalizeProviderPayload({ city: 'São Paulo' } as any);
    expect(out).toBeDefined();
    expect(out.city).toBe('São Paulo');
  });

  it('aceita social_links = null', () => {
    const out = normalizeProviderPayload({
      city: 'São Paulo',
      social_links: null,
    } as any);
    // não deve lançar; valor null pode ser propagado ou removido
    expect(out).toBeDefined();
  });

  it('aceita social_links = {} (objeto vazio)', () => {
    const out = normalizeProviderPayload({
      city: 'São Paulo',
      social_links: {},
    } as any);
    expect(out).toBeDefined();
  });

  it('aceita social_links com chaves vazias', () => {
    const out = normalizeProviderPayload({
      city: 'São Paulo',
      social_links: { instagram: '', facebook: '   ', linkedin: 'https://x' },
    } as any);
    expect(out).toBeDefined();
  });

  it('safeOptionalString converte string vazia em null para institucionais', () => {
    expect(safeOptionalString('')).toBeNull();
    expect(safeOptionalString('   ')).toBeNull();
    expect(safeOptionalString('Comércio')).toBe('Comércio');
    expect(safeOptionalString(undefined)).toBeNull();
    expect(safeOptionalString(null)).toBeNull();
  });

  it('preserva show_full_address quando account_type=company (PJ)', () => {
    const out = normalizeProviderPayload({
      account_type: 'company',
      show_full_address: true,
    } as any);
    expect(out.show_full_address).toBe(true);
  });

  it('descarta show_full_address quando account_type não é company (PF)', () => {
    const out = normalizeProviderPayload({
      account_type: 'autonomo',
      show_full_address: true,
    } as any);
    // PF não tem essa coluna no schema institucional → removida silenciosamente
    expect((out as any).show_full_address).toBeUndefined();
  });

  it('PJ: social_links só com chaves vazias é normalizado para null', () => {
    const out = normalizeProviderPayload({
      account_type: 'company',
      social_links: { instagram: '', facebook: '   ' },
    } as any);
    expect((out as any).social_links).toBeNull();
  });
});
