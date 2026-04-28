/**
 * Garantia que "Meus Serviços" nunca exiba texto fora da seleção de cidades:
 *  - formatServiceArea remove prefixos legados ("Toda Curitiba" -> "Curitiba")
 *  - usa rótulo controlado quando service_radius está presente
 *  - isCatalogedCity bloqueia digitação livre que não pertence ao catálogo
 */
import { describe, it, expect } from 'vitest';
import {
  formatServiceArea,
  stripLegacyAreaPrefixes,
  isCatalogedCity,
} from '@/lib/serviceAreaFormat';

const CATALOG = [
  { value: 'Curitiba', label: 'Curitiba - PR', state: 'PR' },
  { value: 'São José dos Pinhais', label: 'São José dos Pinhais - PR', state: 'PR' },
];

describe('stripLegacyAreaPrefixes', () => {
  it('remove "Toda " (case-insensitive) e mantém a cidade', () => {
    expect(stripLegacyAreaPrefixes('Toda Curitiba')).toBe('Curitiba');
    expect(stripLegacyAreaPrefixes('toda curitiba ')).toBe('curitiba');
    expect(stripLegacyAreaPrefixes('Em toda Curitiba')).toBe('Curitiba');
    expect(stripLegacyAreaPrefixes('Todo Brasil')).toBe('Brasil');
  });
  it('é idempotente para valores já limpos', () => {
    expect(stripLegacyAreaPrefixes('Curitiba')).toBe('Curitiba');
    expect(stripLegacyAreaPrefixes('  Curitiba  ')).toBe('Curitiba');
  });
});

describe('formatServiceArea', () => {
  it('NUNCA emite "Toda Curitiba" (texto fora da seleção)', () => {
    const out = formatServiceArea('Toda Curitiba', null, null);
    expect(out).not.toMatch(/^toda curitiba/i);
    expect(out).toBe('Curitiba');
  });
  it('combina rótulo controlado com cidade do provider quando há radius', () => {
    expect(formatServiceArea(null, 'city', 'Curitiba')).toBe('Toda a cidade — Curitiba');
    expect(formatServiceArea('Toda Curitiba', 'city', 'Curitiba')).toBe('Toda a cidade — Curitiba');
    expect(formatServiceArea(null, 'local', 'Curitiba')).toBe('Atendimento no local — Curitiba');
    expect(formatServiceArea(null, 'metro', 'Curitiba')).toBe('Região metropolitana — Curitiba');
  });
  it('cai em texto bruto sanitizado quando não há radius nem providerCity', () => {
    expect(formatServiceArea('Toda Curitiba')).toBe('Curitiba');
    expect(formatServiceArea('São José dos Pinhais')).toBe('São José dos Pinhais');
  });
  it('retorna string vazia para entradas vazias/nulas', () => {
    expect(formatServiceArea(null)).toBe('');
    expect(formatServiceArea('   ')).toBe('');
  });
});

describe('isCatalogedCity (bloqueia digitação livre no wizard)', () => {
  it('aceita match por value', () => {
    expect(isCatalogedCity('Curitiba', CATALOG)).toBe(true);
    expect(isCatalogedCity('curitiba', CATALOG)).toBe(true);
  });
  it('aceita match por label "Cidade - UF"', () => {
    expect(isCatalogedCity('Curitiba - PR', CATALOG)).toBe(true);
  });
  it('aceita prefixo legado limpando antes', () => {
    expect(isCatalogedCity('Toda Curitiba', CATALOG)).toBe(true);
  });
  it('rejeita texto digitado fora do catálogo', () => {
    expect(isCatalogedCity('Cidade Inventada', CATALOG)).toBe(false);
    expect(isCatalogedCity('curitiba norte', CATALOG)).toBe(false);
    expect(isCatalogedCity('', CATALOG)).toBe(false);
    expect(isCatalogedCity('   ', CATALOG)).toBe(false);
  });
});
