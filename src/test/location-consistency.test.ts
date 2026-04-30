import { describe, it, expect } from 'vitest';
import {
  validateBaseCityVsServiceArea,
  hasBlockingBaseCityIssue,
} from '@/lib/locationConsistency';

describe('validateBaseCityVsServiceArea', () => {
  it('aceita cenário correto: São José dos Pinhais como cidade-base', () => {
    const issues = validateBaseCityVsServiceArea({
      city: 'São José dos Pinhais',
      state: 'PR',
      neighborhood: 'Centro',
    });
    expect(issues).toEqual([]);
  });

  it('bloqueia "Região Metropolitana de Curitiba" como cidade-base', () => {
    const issues = validateBaseCityVsServiceArea({
      city: 'Região Metropolitana de Curitiba',
      state: 'PR',
      neighborhood: 'Centro',
    });
    expect(issues.some((i) => i.code === 'regional_label_in_city')).toBe(true);
    const regional = issues.find((i) => i.code === 'regional_label_in_city');
    expect(regional?.moveToServiceArea).toBe('Região Metropolitana de Curitiba');
    expect(hasBlockingBaseCityIssue(issues)).toBe(true);
  });

  it('bloqueia bairro = cidade', () => {
    const issues = validateBaseCityVsServiceArea({
      city: 'São José dos Pinhais',
      state: 'PR',
      neighborhood: 'São José dos Pinhais',
    });
    expect(issues.some((i) => i.code === 'neighborhood_equals_city')).toBe(true);
  });

  it('bloqueia bairro = label regional', () => {
    const issues = validateBaseCityVsServiceArea({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Microrregião de Curitiba',
    });
    expect(issues.some((i) => i.code === 'regional_label_in_neighborhood')).toBe(true);
  });

  it('exige cidade e UF', () => {
    const issues = validateBaseCityVsServiceArea({ city: '', state: '', neighborhood: '' });
    expect(issues.some((i) => i.code === 'empty_city')).toBe(true);
    expect(issues.some((i) => i.code === 'invalid_state')).toBe(true);
    expect(hasBlockingBaseCityIssue(issues)).toBe(true);
  });
});
