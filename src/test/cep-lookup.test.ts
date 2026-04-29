/**
 * Testes do helper lookupCep — validação e formatação.
 * Não bate em rede real (mockamos fetch).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeCep, formatCep, onlyDigits, lookupCep } from '@/lib/cepLookup';

describe('cepLookup helpers', () => {
  it('onlyDigits remove tudo que não é número', () => {
    expect(onlyDigits('01310-100')).toBe('01310100');
    expect(onlyDigits('abc 123')).toBe('123');
  });

  it('normalizeCep aceita 8 dígitos e rejeita o resto', () => {
    expect(normalizeCep('01310100')).toBe('01310100');
    expect(normalizeCep('01310-100')).toBe('01310100');
    expect(normalizeCep('1234')).toBeNull();
    expect(normalizeCep('00000000')).toBeNull();
    expect(normalizeCep('99999999')).toBeNull();
    expect(normalizeCep('abcdefgh')).toBeNull();
  });

  it('formatCep produz 00000-000', () => {
    expect(formatCep('01310100')).toBe('01310-100');
  });
});

describe('lookupCep — fluxos principais', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejeita CEP em formato inválido sem chamar a rede', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
    const r = await lookupCep('123');
    if (r.ok) throw new Error('expected failure');
    expect(r.reason).toBe('invalid_format');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('usa BrasilAPI quando disponível', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ city: 'Curitiba', state: 'PR', neighborhood: 'Centro', street: 'Rua X' }), { status: 200 })
    );
    const r = await lookupCep('80010-010');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.city).toBe('Curitiba');
      expect(r.state).toBe('PR');
      expect(r.source).toBe('brasilapi');
    }
  });

  it('faz fallback para ViaCEP quando BrasilAPI falha', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any)
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ localidade: 'São Paulo', uf: 'SP', bairro: 'Sé', logradouro: 'Praça da Sé' }), { status: 200 })
      );
    const r = await lookupCep('01001-000');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.city).toBe('São Paulo');
      expect(r.state).toBe('SP');
      expect(r.source).toBe('viacep');
    }
  });

  it('retorna not_found quando ambas as APIs falham', async () => {
    vi.spyOn(globalThis, 'fetch' as any)
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ erro: true }), { status: 200 }));
    const r = await lookupCep('99999-998');
    if (r.ok) throw new Error('expected failure');
    expect(r.reason).toBe('not_found');
  });
});
