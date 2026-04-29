import { describe, it, expect } from 'vitest';
import { extractSpecialties } from '@/lib/specialtyExtractor';

describe('extractSpecialties', () => {
  it('returns [] for empty / short text', () => {
    expect(extractSpecialties([null, undefined, ''])).toEqual([]);
    expect(extractSpecialties(['oi'])).toEqual([]);
  });

  it('detects normas técnicas e termos compostos', () => {
    const out = extractSpecialties([
      'Especialista em quadros elétricos, fiação e atendimento conforme NBR 5410.',
    ]);
    expect(out).toContain('NBR 5410');
    expect(out).toContain('Quadros Elétricos');
    expect(out).toContain('Fiação');
  });

  it('limita ao máximo informado e mantém únicos', () => {
    const out = extractSpecialties([
      'aterramento, SPDA, para-raios, NR-10, NR-35, vazamentos, desentupimento',
    ], 3);
    expect(out.length).toBe(3);
    expect(new Set(out).size).toBe(out.length);
  });

  it('é case-insensitive', () => {
    expect(extractSpecialties(['DRYWALL e Gesso 3D']))
      .toEqual(expect.arrayContaining(['Drywall', 'Gesso 3D']));
  });
});
