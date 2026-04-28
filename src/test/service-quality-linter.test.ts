/**
 * Testes do linter anti-leilão e do score do anúncio Padrão Ouro.
 */

import { describe, it, expect } from 'vitest';
import {
  lintServiceDescription,
  computeAdScore,
  sanitizePastedCity,
  rewriteWithQuality,
  FORBIDDEN_TERMS,
} from '@/lib/serviceQualityLinter';

describe('rewriteWithQuality — botão "Reescrever com qualidade"', () => {
  it('substitui um único termo proibido por sugestão técnica', () => {
    const out = rewriteWithQuality('Faço serviço barato.');
    expect(out.toLowerCase()).not.toMatch(/barato/);
    expect(out).toMatch(/custo-benefício/i);
  });

  it('substitui múltiplos termos em uma única passagem', () => {
    const out = rewriteWithQuality('Trabalho barato com desconto e leilão de orçamento.');
    expect(lintServiceDescription(out).length).toBe(0);
  });

  it('retorna string vazia para entrada vazia', () => {
    expect(rewriteWithQuality('')).toBe('');
  });

  it('mantém texto que não contém termos proibidos', () => {
    const original = 'Atendimento técnico especializado em refrigeração comercial.';
    expect(rewriteWithQuality(original)).toBe(original);
  });
});


describe('lintServiceDescription — termos proibidos (anti-leilão)', () => {
  it('detecta "barato" e sugere valorização', () => {
    const hits = lintServiceDescription('Faço preço barato para todos.');
    expect(hits.length).toBe(1);
    expect(hits[0].term).toBe('barato');
    expect(hits[0].suggestion).toMatch(/custo-benefício/i);
  });

  it('detecta variações sem acento (orcamento, promocao)', () => {
    expect(lintServiceDescription('Faço orcamento gratis').length).toBeGreaterThan(0);
    expect(lintServiceDescription('Promocao da semana').length).toBeGreaterThan(0);
  });

  it('detecta com acento (orçamento, promoção, leilão)', () => {
    expect(lintServiceDescription('orçamento sem compromisso').length).toBeGreaterThan(0);
    expect(lintServiceDescription('promoção imperdível').length).toBeGreaterThan(0);
    expect(lintServiceDescription('virou leilão').length).toBeGreaterThan(0);
  });

  it('não dispara em texto técnico válido', () => {
    expect(
      lintServiceDescription(
        'Profissional especializado em redes residenciais e comerciais com 10 anos de experiência.',
      ),
    ).toEqual([]);
  });

  it('todos os termos do dicionário possuem sugestão não vazia', () => {
    Object.entries(FORBIDDEN_TERMS).forEach(([term, suggestion]) => {
      expect(suggestion.length).toBeGreaterThan(10);
      expect(term.length).toBeGreaterThan(0);
    });
  });
});

describe('computeAdScore — score 0-100 do anúncio Padrão Ouro', () => {
  it('anúncio vazio = 0%', () => {
    const r = computeAdScore({
      description: '',
      hasOriginalPhoto: false,
      cityValidated: false,
      hasPrice: false,
      hasCategory: false,
    });
    expect(r.score).toBe(0);
    expect(r.isPadrãoOuro).toBe(false);
  });

  it('anúncio completo = 100% e Padrão Ouro', () => {
    const r = computeAdScore({
      description: 'a'.repeat(220),
      hasOriginalPhoto: true,
      cityValidated: true,
      hasPrice: true,
      hasCategory: true,
    });
    expect(r.score).toBe(100);
    expect(r.isPadrãoOuro).toBe(true);
  });

  it('descrição curta NÃO atinge Padrão Ouro mesmo com tudo', () => {
    const r = computeAdScore({
      description: 'curto',
      hasOriginalPhoto: true,
      cityValidated: true,
      hasPrice: true,
      hasCategory: true,
    });
    expect(r.score).toBeLessThan(100);
    expect(r.isPadrãoOuro).toBe(false);
  });

  it('soma exata por critério', () => {
    const r = computeAdScore({
      description: '',
      hasOriginalPhoto: true, // 25
      cityValidated: true, // 20
      hasPrice: false,
      hasCategory: true, // 15
    });
    expect(r.score).toBe(25 + 20 + 15);
  });
});

describe('sanitizePastedCity — sanitização on-the-fly', () => {
  it('remove "Toda "', () => {
    expect(sanitizePastedCity('Toda Curitiba')).toBe('Curitiba');
  });

  it('remove "Em toda "', () => {
    expect(sanitizePastedCity('Em toda São Paulo')).toBe('São Paulo');
  });

  it('remove "Atendemos em "', () => {
    expect(sanitizePastedCity('Atendemos em Goiânia')).toBe('Goiânia');
  });

  it('remove "Atendo em "', () => {
    expect(sanitizePastedCity('Atendo em Brasília')).toBe('Brasília');
  });

  it('preserva texto limpo', () => {
    expect(sanitizePastedCity('Florianópolis')).toBe('Florianópolis');
  });

  it('lida com vazio/whitespace', () => {
    expect(sanitizePastedCity('')).toBe('');
    expect(sanitizePastedCity('   ')).toBe('');
  });
});
