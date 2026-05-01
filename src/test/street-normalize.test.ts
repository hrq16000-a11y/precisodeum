/**
 * Cobre a normalização robusta de logradouros:
 *  - acentos / case
 *  - pontuação variada (vírgula, ponto, hífen, barra, ponto-e-vírgula, parênteses)
 *  - abreviações (R. / Rua, Av. / Avenida, Tv / Travessa, Pç / Praça etc.)
 *  - stopwords (de, da, do, dos, das, e)
 *  - múltiplos espaços
 *
 * Detecta conflito real entre o que o usuário digitou e o logradouro vindo
 * do CEP, mas NÃO sinaliza como conflito variações puramente cosméticas.
 */
import { describe, it, expect } from 'vitest';
import { normalizeStreet, isSameStreet } from '@/lib/streetNormalize';

describe('streetNormalize — abreviações + pontuação + acentos', () => {
  it('considera "Av. Paulista" e "Avenida Paulista" iguais', () => {
    expect(isSameStreet('Av. Paulista', 'Avenida Paulista')).toBe(true);
  });

  it('considera "R. das Flores" e "Rua das Flores" iguais (case + abrev + stopword)', () => {
    expect(isSameStreet('R. das Flores', 'Rua das Flores')).toBe(true);
    expect(isSameStreet('rua das flores', 'RUA  DAS   FLORES')).toBe(true);
  });

  it('absorve acentos e hífens', () => {
    expect(isSameStreet('Avenida São João', 'Av Sao-Joao')).toBe(true);
    expect(isSameStreet('Praça da Sé', 'Pç. da Se')).toBe(true);
    expect(isSameStreet('Travessa do Comércio', 'Tv. do Comercio')).toBe(true);
  });

  it('absorve pontuação variada e parênteses', () => {
    expect(isSameStreet('Rua, das/Flores;', 'Rua das Flores')).toBe(true);
    expect(isSameStreet('R. (das) Flores.', 'Rua das Flores')).toBe(true);
  });

  it('detecta conflito real entre ruas diferentes', () => {
    expect(isSameStreet('Rua das Flores', 'Avenida Paulista')).toBe(false);
    expect(isSameStreet('Av. Brasil', 'Av. Brasília')).toBe(false);
  });

  it('strings vazias nunca dão match', () => {
    expect(isSameStreet('', '')).toBe(false);
    expect(isSameStreet('Rua X', '')).toBe(false);
  });

  it('normalizeStreet retorna forma canônica reutilizável', () => {
    expect(normalizeStreet('Av. Paulista')).toBe('avenida paulista');
    expect(normalizeStreet('R. das Flores')).toBe('rua flores');
    expect(normalizeStreet('Praça da Sé')).toBe('praca se');
  });
});
