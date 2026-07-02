import { describe, it, expect } from 'vitest';
import { normalizeUF, safeUF, isValidUF, formatCityState } from '@/lib/locationFormat';

describe('locationFormat.normalizeUF (unified UF normalizer)', () => {
  it('returns 2-letter UF as-is when uppercase', () => {
    expect(normalizeUF('SP')).toBe('SP');
    expect(normalizeUF('PR')).toBe('PR');
    expect(normalizeUF('DF')).toBe('DF');
  });

  it('uppercases lowercase 2-letter codes', () => {
    expect(normalizeUF('sp')).toBe('SP');
    expect(normalizeUF('pr')).toBe('PR');
  });

  it('trims whitespace around 2-letter codes', () => {
    expect(normalizeUF('  SP  ')).toBe('SP');
    expect(normalizeUF('\tpr\n')).toBe('PR');
  });

  it('resolves full state names (with and without accents)', () => {
    expect(normalizeUF('São Paulo')).toBe('SP');
    expect(normalizeUF('sao paulo')).toBe('SP');
    expect(normalizeUF('Paraná')).toBe('PR');
    expect(normalizeUF('parana')).toBe('PR');
    expect(normalizeUF('RIO DE JANEIRO')).toBe('RJ');
    expect(normalizeUF('Distrito Federal')).toBe('DF');
  });

  it('returns null for unknown / partial inputs (no slice fallback)', () => {
    expect(normalizeUF('St')).toBeNull();
    expect(normalizeUF('Sa')).toBeNull();
    expect(normalizeUF('Sã')).toBeNull();
    expect(normalizeUF('Brasil')).toBeNull();
    expect(normalizeUF('xx')).toBeNull();
    expect(normalizeUF('')).toBeNull();
    expect(normalizeUF(null)).toBeNull();
    expect(normalizeUF(undefined)).toBeNull();
    expect(normalizeUF('   ')).toBeNull();
  });

  it('rejects invalid 2-letter combos that look like UFs', () => {
    expect(normalizeUF('XY')).toBeNull();
    expect(normalizeUF('ZZ')).toBeNull();
  });
});

describe('locationFormat.safeUF', () => {
  it('returns empty string for unknown values (never "St"/"Sa")', () => {
    expect(safeUF('St')).toBe('');
    expect(safeUF('Sa')).toBe('');
    expect(safeUF(null)).toBe('');
    expect(safeUF('Brasil')).toBe('');
  });
  it('returns the UF for valid inputs', () => {
    expect(safeUF('sp')).toBe('SP');
    expect(safeUF('São Paulo')).toBe('SP');
  });
});

describe('locationFormat.isValidUF', () => {
  it('accepts valid UFs in any case', () => {
    expect(isValidUF('sp')).toBe(true);
    expect(isValidUF('SP')).toBe(true);
    expect(isValidUF(' rj ')).toBe(true);
  });
  it('rejects unknown UFs', () => {
    expect(isValidUF('XX')).toBe(false);
    expect(isValidUF('São Paulo')).toBe(false); // not a 2-letter code
    expect(isValidUF('')).toBe(false);
    expect(isValidUF(null)).toBe(false);
  });
});

describe('locationFormat.formatCityState', () => {
  it('combines city and UF when valid', () => {
    expect(formatCityState('Curitiba', 'PR')).toBe('Curitiba - PR');
    expect(formatCityState('Curitiba', 'paraná', ' • ')).toBe('Curitiba • PR');
  });
  it('returns just city when UF is unknown', () => {
    expect(formatCityState('Curitiba', 'St')).toBe('Curitiba');
    expect(formatCityState('Curitiba', null)).toBe('Curitiba');
  });
  it('returns empty string when city is missing', () => {
    expect(formatCityState('', 'SP')).toBe('');
    expect(formatCityState(null, 'SP')).toBe('');
  });
});
