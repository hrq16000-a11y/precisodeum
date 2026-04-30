import { describe, it, expect } from 'vitest';
import { normalizeServiceArea, flattenServiceArea } from '@/lib/serviceAreaNormalize';

describe('normalizeServiceArea', () => {
  it('remove cidade-base duplicada da área de atendimento', () => {
    const r = normalizeServiceArea(['São José dos Pinhais/PR', 'Curitiba/PR'], 'São José dos Pinhais');
    expect(r.cities).toEqual(['Curitiba/PR']);
    expect(r.removed.length).toBe(1);
  });

  it('separa labels regionais de cidades comuns', () => {
    const r = normalizeServiceArea(
      ['Curitiba/PR', 'Região Metropolitana de Curitiba', 'Pinhais/PR'],
      'São José dos Pinhais',
    );
    expect(r.cities).toContain('Curitiba/PR');
    expect(r.cities).toContain('Pinhais/PR');
    expect(r.regions).toContain('Região Metropolitana de Curitiba');
  });

  it('deduplica variações de acentuação', () => {
    const r = normalizeServiceArea(['São Paulo/SP', 'Sao Paulo/SP', 'são paulo/sp'], 'Curitiba');
    expect(r.cities.length).toBe(1);
    expect(r.removed.length).toBe(2);
  });

  it('aceita lista vazia', () => {
    expect(normalizeServiceArea(null, 'Curitiba').cities).toEqual([]);
    expect(normalizeServiceArea([], 'Curitiba').regions).toEqual([]);
  });

  it('flatten produz cidades + regiões', () => {
    const r = normalizeServiceArea(['Curitiba/PR', 'Região Metropolitana de Curitiba'], 'SJP');
    expect(flattenServiceArea(r)).toEqual(['Curitiba/PR', 'Região Metropolitana de Curitiba']);
  });
});
