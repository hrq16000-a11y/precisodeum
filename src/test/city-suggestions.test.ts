/**
 * Testes para suggestCitiesFromCep + integração do CepLookupField com sugestões.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock as any);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ ilike: () => ({ limit: async () => ({ data: [] }) }) }) }) },
}));

import { suggestCitiesFromCep } from '@/lib/citySuggestions';

describe('suggestCitiesFromCep', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('retorna [] para entrada vazia', async () => {
    const r = await suggestCitiesFromCep('');
    expect(r).toEqual([]);
  });

  it('sugere cidade quando prefixo encontra correspondência via BrasilAPI', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ city: 'São José dos Pinhais', state: 'PR' }),
    });
    const r = await suggestCitiesFromCep('83000');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].city).toBe('São José dos Pinhais');
    expect(r[0].state).toBe('PR');
  });

  it('retorna [] quando todas as variações falham', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    const r = await suggestCitiesFromCep('99999');
    expect(r).toEqual([]);
  });
});
