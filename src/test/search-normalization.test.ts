import { describe, it, expect } from 'vitest';
import {
  expandSearchTerms,
  normalizeSearchText,
  evaluateTextMatch,
  buildProviderSearchBlob,
} from '@/lib/searchNormalization';

const makeProvider = (over: Partial<any> = {}) => ({
  id: 'p',
  name: 'Maria Silva',
  category: 'Babá',
  categorySlug: 'baba',
  description: 'Cuidadora infantil experiente',
  city: 'São José dos Pinhais',
  neighborhood: 'Centro',
  state: 'PR',
  ...over,
});

describe('searchNormalization', () => {
  it('normaliza removendo acentos, hífens e caixa', () => {
    expect(normalizeSearchText('Babá Açaí - Construção')).toBe('baba acai construcao');
  });

  it('expande "baba" em sinônimos', () => {
    const terms = expandSearchTerms('baba');
    expect(terms).toEqual(expect.arrayContaining(['baba', 'cuidadora', 'crianca', 'infantil']));
  });

  it('expande "diarista" em sinônimos de limpeza', () => {
    const terms = expandSearchTerms('diarista');
    expect(terms).toEqual(expect.arrayContaining(['diarista', 'faxina', 'faxineira', 'limpeza']));
  });

  it('expande "free lance" em freelance/freelancer', () => {
    const terms = expandSearchTerms('free lance');
    expect(terms).toEqual(expect.arrayContaining(['freelance', 'freelancer']));
  });

  it('expande "construção" em termos de obra', () => {
    const terms = expandSearchTerms('construção');
    expect(terms).toEqual(expect.arrayContaining(['construcao', 'pedreiro', 'reforma']));
  });

  it('encontra babá com query "baba" via sinônimo', () => {
    const provider = makeProvider();
    const terms = expandSearchTerms('baba');
    const r = evaluateTextMatch(provider, terms);
    expect(r.matched).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('NÃO encontra pedreiro quando query é "baba"', () => {
    const pedreiro = makeProvider({
      name: 'José Construtor',
      category: 'Pedreiro',
      categorySlug: 'pedreiro',
      description: 'Reformas e alvenaria',
    });
    const terms = expandSearchTerms('baba');
    expect(evaluateTextMatch(pedreiro, terms).matched).toBe(false);
  });

  it('encontra diarista quando query é "faxina"', () => {
    const provider = makeProvider({
      name: 'Joana Faxineira',
      category: 'Diarista',
      categorySlug: 'diarista',
      description: 'Limpeza pesada',
    });
    expect(evaluateTextMatch(provider, expandSearchTerms('faxina')).matched).toBe(true);
  });

  it('blob inclui categorySlug para evitar interpretação errada', () => {
    const blob = buildProviderSearchBlob(makeProvider());
    expect(blob).toContain('baba');
    expect(blob).toContain('cuidadora infantil');
  });

  it('match completo recebe bônus no score (>= match parcial)', () => {
    const provider = makeProvider({ description: 'pedreiro alvenaria' });
    const partial = evaluateTextMatch(provider, ['pedreiro', 'inexistente']);
    const full = evaluateTextMatch(provider, ['pedreiro', 'alvenaria']);
    expect(full.score).toBeGreaterThan(partial.score);
  });
});
