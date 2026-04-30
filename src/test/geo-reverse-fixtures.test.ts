/**
 * Fixtures para parse e sanitização de bairro nas respostas do
 * BigDataCloud (BDC) e do Nominatim (OSM).
 *
 * Garante:
 *  - bairro nunca igual à cidade
 *  - bairro nunca label regional ("Região Metropolitana...")
 *  - reconhecimento de city_district / suburb / quarter / adminLevel 10
 */
import { describe, it, expect } from 'vitest';
import { parseReverseGeocodeLocation, sanitizeNeighborhood, isRegionalLabel } from '@/lib/geoReverseGeocode';

describe('BigDataCloud fixtures', () => {
  it('extrai bairro quando vem em informative com adminLevel 10', () => {
    const fixture = {
      city: 'São José dos Pinhais',
      principalSubdivision: 'PR',
      localityInfo: {
        administrative: [
          { name: 'São José dos Pinhais', description: 'município', adminLevel: 8 },
        ],
        informative: [
          { name: 'Centro', description: 'neighbourhood', adminLevel: 10 },
        ],
      },
    };
    const r = parseReverseGeocodeLocation(fixture);
    expect(r.city).toBe('São José dos Pinhais');
    expect(r.state).toBe('PR');
    expect(r.neighborhood).toBe('Centro');
  });

  it('rejeita bairro igual ao nome da cidade', () => {
    const fixture = {
      city: 'Curitiba',
      principalSubdivision: 'PR',
      localityInfo: {
        administrative: [{ name: 'Curitiba', description: 'município', adminLevel: 8 }],
        informative: [{ name: 'Curitiba', description: 'locality', adminLevel: 9 }],
      },
    };
    const r = parseReverseGeocodeLocation(fixture);
    expect(r.neighborhood).toBeNull();
  });

  it('rejeita "Região Metropolitana" como cidade-base', () => {
    const fixture = {
      city: 'Região Metropolitana de Curitiba',
      principalSubdivision: 'PR',
      localityInfo: {
        administrative: [
          { name: 'Curitiba', description: 'município', adminLevel: 8 },
        ],
      },
    };
    const r = parseReverseGeocodeLocation(fixture);
    expect(r.city).toBe('Curitiba');
  });

  it('detecta label regional com isRegionalLabel', () => {
    expect(isRegionalLabel('Região Metropolitana de Curitiba')).toBe(true);
    expect(isRegionalLabel('Microrregião de Pinhais')).toBe(true);
    expect(isRegionalLabel('Centro')).toBe(false);
  });
});

describe('Nominatim address sanitização', () => {
  // Simulação do shape que useGeoCity converte
  function simulateOsmParse(address: Record<string, string | undefined>) {
    const neighborhood =
      address.neighbourhood ||
      address.suburb ||
      address.quarter ||
      address.city_district ||
      address.residential ||
      address.hamlet ||
      null;
    const city = address.city || address.town || address.village || address.municipality || null;
    return { city, neighborhood: sanitizeNeighborhood(neighborhood, city) };
  }

  it('usa suburb quando neighbourhood ausente', () => {
    const r = simulateOsmParse({
      city: 'São José dos Pinhais',
      suburb: 'Centro',
    });
    expect(r.neighborhood).toBe('Centro');
  });

  it('usa city_district como fallback de bairro', () => {
    const r = simulateOsmParse({
      city: 'Curitiba',
      city_district: 'Batel',
    });
    expect(r.neighborhood).toBe('Batel');
  });

  it('rejeita bairro igual à cidade', () => {
    const r = simulateOsmParse({
      city: 'Pinhais',
      suburb: 'Pinhais',
    });
    expect(r.neighborhood).toBeNull();
  });

  it('rejeita label regional como bairro', () => {
    const r = simulateOsmParse({
      city: 'Curitiba',
      suburb: 'Região Metropolitana',
    });
    expect(r.neighborhood).toBeNull();
  });
});
