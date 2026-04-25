import { describe, it, expect } from 'vitest';
import { formatCityState, safeUF, normalizeUF } from '@/lib/locationFormat';

describe('location display safety', () => {
  it('never returns "City - " when state is empty/null/undefined', () => {
    const cases = [null, undefined, '', '   '];
    cases.forEach((s) => {
      const out = formatCityState('Curitiba', s as any);
      expect(out).not.toMatch(/-\s*$/);
      expect(out).not.toContain(' - ');
      expect(out).toBe('Curitiba');
    });
  });

  it('renders "Cidade - UF" when state is a 2-letter code', () => {
    expect(formatCityState('Curitiba', 'PR')).toBe('Curitiba - PR');
    expect(formatCityState('Florianópolis', 'sc')).toBe('Florianópolis - SC');
  });

  it('normalizes full state names to UF and never displays them', () => {
    expect(normalizeUF('Santa Catarina')).toBe('SC');
    expect(normalizeUF('São Paulo')).toBe('SP');
    expect(formatCityState('Florianópolis', 'Santa Catarina')).toBe('Florianópolis - SC');
    expect(formatCityState('Florianópolis', 'Santa Catarina')).not.toContain('Santa Catarina');
  });

  it('rejects garbage state inputs (St, Sa, Brasil)', () => {
    ['St', 'Sa', 'Sã', 'Brasil', 'XX'].forEach((bad) => {
      expect(safeUF(bad)).toBe('');
      expect(formatCityState('Curitiba', bad)).toBe('Curitiba');
    });
  });

  it('does not produce trailing hyphen artifacts under any combo', () => {
    const inputs: Array<[string, any]> = [
      ['Curitiba', null], ['Curitiba', ''], ['Curitiba', 'XX'],
      ['Florianópolis', 'Santa Catarina'], ['São Paulo', 'sp'],
    ];
    inputs.forEach(([c, s]) => {
      const out = formatCityState(c, s);
      expect(out.endsWith('-')).toBe(false);
      expect(out.endsWith('- ')).toBe(false);
      expect(/\bSanta Catarina\b/.test(out)).toBe(false);
    });
  });
});
