import { describe, it, expect } from 'vitest';
import {
  handymanNeighborhoodSlug,
  handymanSlugCandidates,
  humanizeSlug,
  slugifyNeighborhood,
} from '@/lib/handymanServiceContent';

describe('handyman neighborhood slugs', () => {
  it('slugify remove acentos: "Água Verde" -> "agua-verde"', () => {
    expect(slugifyNeighborhood('Água Verde')).toBe('agua-verde');
    expect(slugifyNeighborhood('Jardim São Luís')).toBe('jardim-sao-luis');
    expect(slugifyNeighborhood('Batel')).toBe('batel');
  });

  it('match acento-insensitivo: slug da rota encontra bairro acentuado do banco', () => {
    const stored = 'Água Verde';
    const routeSlug = 'agua-verde';
    expect(slugifyNeighborhood(stored)).toBe(routeSlug);
  });

  it('deriva bairro do slug completo: curitiba-agua-verde -> agua-verde', () => {
    expect(handymanNeighborhoodSlug('curitiba-agua-verde', 'curitiba')).toBe('agua-verde');
    expect(handymanNeighborhoodSlug('curitiba', 'curitiba')).toBe('');
    expect(handymanNeighborhoodSlug('santos', 'curitiba')).toBe('');
  });

  it('candidatos de cidade vão do mais longo ao mais curto', () => {
    expect(handymanSlugCandidates('sao-jose-dos-pinhais-portal')).toEqual([
      'sao-jose-dos-pinhais-portal',
      'sao-jose-dos-pinhais',
      'sao-jose-dos',
      'sao-jose',
      'sao',
    ]);
  });

  it('humanizeSlug gera rótulo legível de fallback', () => {
    expect(humanizeSlug('agua-verde')).toBe('Agua Verde');
  });
});
