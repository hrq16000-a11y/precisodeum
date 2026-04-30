import { describe, it, expect } from 'vitest';
import {
  parseReverseGeocodeLocation,
  sanitizeNeighborhood,
  isRegionalLabel,
} from '@/lib/geoReverseGeocode';

describe('geoReverseGeocode — bairro confiável', () => {
  it('rejeita bairro igual à cidade (caso São José dos Pinhais)', () => {
    const out = parseReverseGeocodeLocation({
      city: 'São José dos Pinhais',
      locality: 'São José dos Pinhais',
      principalSubdivision: 'Paraná',
      localityInfo: { administrative: [], informative: [] },
    });
    expect(out.city).toBe('São José dos Pinhais');
    expect(out.neighborhood).toBeNull();
  });

  it('rejeita label de Região Metropolitana como cidade', () => {
    const out = parseReverseGeocodeLocation({
      city: 'Região Metropolitana de Curitiba',
      locality: 'São José dos Pinhais',
      principalSubdivision: 'Paraná',
      localityInfo: {
        administrative: [
          { name: 'São José dos Pinhais', description: 'município', adminLevel: 8 },
        ],
      },
    });
    expect(out.city).toBe('São José dos Pinhais');
  });

  it('preserva bairro quando explícito e diferente da cidade', () => {
    const out = parseReverseGeocodeLocation({
      city: 'São José dos Pinhais',
      locality: 'Centro',
      principalSubdivision: 'Paraná',
      localityInfo: {
        administrative: [
          { name: 'Centro', description: 'bairro' },
        ],
      },
    });
    expect(out.neighborhood).toBe('Centro');
  });

  it('sanitizeNeighborhood rejeita bairro igual à cidade', () => {
    expect(sanitizeNeighborhood('São José dos Pinhais', 'São José dos Pinhais')).toBeNull();
    expect(sanitizeNeighborhood('SAO JOSE DOS PINHAIS', 'São José dos Pinhais')).toBeNull();
  });

  it('sanitizeNeighborhood rejeita label regional', () => {
    expect(sanitizeNeighborhood('Região Metropolitana de Curitiba', 'Curitiba')).toBeNull();
    expect(sanitizeNeighborhood('Microrregião X', 'Curitiba')).toBeNull();
  });

  it('sanitizeNeighborhood preserva bairro válido', () => {
    expect(sanitizeNeighborhood('Boa Vista', 'Curitiba')).toBe('Boa Vista');
    expect(sanitizeNeighborhood('  Centro  ', 'São José dos Pinhais')).toBe('Centro');
  });

  it('isRegionalLabel detecta variantes', () => {
    expect(isRegionalLabel('Região Metropolitana de Curitiba')).toBe(true);
    expect(isRegionalLabel('Microrregião')).toBe(true);
    expect(isRegionalLabel('Centro')).toBe(false);
  });
});
