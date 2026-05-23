import { describe, it, expect } from 'vitest';
import {
  isSeoContentEligible,
  buildContentBlocks,
  MIN_AGGREGATED_WORDS,
} from '@/lib/seo/seoContentBlocks';

describe('seoContentBlocks · isSeoContentEligible', () => {
  it('fail-closed: sem sinais → inelegível', () => {
    expect(isSeoContentEligible({}).eligible).toBe(false);
  });

  it('elegível com providers suficientes', () => {
    const v = isSeoContentEligible({ providersCount: 5 });
    expect(v.eligible).toBe(true);
    expect(v.reasons).toContain('providers');
  });

  it('elegível por sponsor ativo', () => {
    expect(isSeoContentEligible({ hasSponsor: true }).eligible).toBe(true);
  });

  it('elegível por tráfego e conversão', () => {
    const v = isSeoContentEligible({ monthlyViews: 200, conversionRate: 0.05 });
    expect(v.reasons).toEqual(expect.arrayContaining(['traffic', 'conversion']));
  });

  it('elegível por conteúdo manual', () => {
    expect(isSeoContentEligible({ manualContentChars: 500 }).eligible).toBe(true);
  });
});

describe('seoContentBlocks · buildContentBlocks', () => {
  it('retorna [] quando inelegível', () => {
    expect(buildContentBlocks({ categoryName: 'Eletricista' })).toEqual([]);
  });

  it('gera blocos suficientes para passar o mínimo de palavras', () => {
    const blocks = buildContentBlocks({
      categoryName: 'Eletricista',
      cityName: 'Curitiba',
      providersCount: 5,
    });
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    const totalWords = blocks.reduce(
      (n, b) => n + b.paragraphs.join(' ').split(/\s+/).length + b.title.split(/\s+/).length,
      0,
    );
    expect(totalWords).toBeGreaterThanOrEqual(MIN_AGGREGATED_WORDS);
  });

  it('inclui local_tips quando há cidade', () => {
    const blocks = buildContentBlocks({
      categoryName: 'Pintor',
      cityName: 'Pinhais',
      providersCount: 4,
    });
    expect(blocks.some((b) => b.kind === 'local_tips')).toBe(true);
  });
});
