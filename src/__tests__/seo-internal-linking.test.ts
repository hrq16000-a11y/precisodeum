import { describe, it, expect } from 'vitest';
import {
  buildRelatedLinks,
  internalLinkPriority,
  MAX_LINKS_PER_BLOCK,
  MAX_BLOCKS,
  MAX_TOTAL_LINKS,
} from '@/lib/seoInternalLinking';

describe('internalLinkPriority', () => {
  it('zero quando inelegível', () => {
    expect(internalLinkPriority({ isEligible: false, ctr: 0.5 })).toBe(0);
  });
  it('cresce com CTR + sponsor', () => {
    const low = internalLinkPriority({ ctr: 0.01 });
    const high = internalLinkPriority({ ctr: 0.1, isSponsored: true, leads: 50 });
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
  });
  it('base neutra ~0.4 sem signals', () => {
    expect(internalLinkPriority()).toBeCloseTo(0.4, 1);
  });
});

describe('buildRelatedLinks · limites e segurança', () => {
  it('exclui currentPath e slugs inválidos', () => {
    const blocks = buildRelatedLinks({
      currentPath: '/categoria/eletricista/em/curitiba',
      categorySlug: 'eletricista',
      relatedCities: [
        { name: 'Curitiba', slug: 'curitiba' },
        { name: 'Pinhais', slug: 'pinhais' },
        { name: 'Inválido', slug: 'NÃO-VÁLIDO' },
      ],
    });
    const all = blocks.flatMap((b) => b.links.map((l) => l.href));
    expect(all).not.toContain('/categoria/eletricista/em/curitiba');
    expect(all).toContain('/categoria/eletricista/em/pinhais');
    expect(all.some((h) => h.includes('NÃO'))).toBe(false);
  });

  it('respeita MAX_LINKS_PER_BLOCK', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      name: `Cidade ${i}`,
      slug: `cidade-${i}`,
    }));
    const blocks = buildRelatedLinks({
      currentPath: '/categoria/x',
      categorySlug: 'eletricista',
      relatedCities: many,
    });
    expect(blocks[0].links.length).toBe(MAX_LINKS_PER_BLOCK);
  });

  it('respeita MAX_BLOCKS e MAX_TOTAL_LINKS', () => {
    const many = (prefix: string) =>
      Array.from({ length: 12 }, (_, i) => ({ name: `${prefix} ${i}`, slug: `${prefix}-${i}` }));
    const blocks = buildRelatedLinks({
      currentPath: '/x',
      citySlug: 'curitiba',
      categorySlug: 'eletricista',
      relatedCities: many('cidade'),
      relatedCategories: many('cat'),
      nearbyCities: many('near').map((c) => ({ ...c, distanceKm: 10 })),
      relatedNeighborhoods: many('bairro'),
      highConversionProviders: many('prov'),
      trendingSearches: many('trend').map((t) => ({ label: t.name, slug: t.slug })),
    });
    expect(blocks.length).toBeLessThanOrEqual(MAX_BLOCKS);
    const total = blocks.reduce((n, b) => n + b.links.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_LINKS);
  });

  it('filtra paths thin', () => {
    const thin = new Set<string>(['/categoria/eletricista/em/pinhais']);
    const blocks = buildRelatedLinks({
      currentPath: '/categoria/eletricista/em/curitiba',
      categorySlug: 'eletricista',
      relatedCities: [
        { name: 'Pinhais', slug: 'pinhais' },
        { name: 'São José', slug: 'sao-jose-dos-pinhais' },
      ],
      thinPaths: thin,
    });
    const hrefs = blocks.flatMap((b) => b.links.map((l) => l.href));
    expect(hrefs).not.toContain('/categoria/eletricista/em/pinhais');
    expect(hrefs).toContain('/categoria/eletricista/em/sao-jose-dos-pinhais');
  });

  it('ordena por prioridade decrescente', () => {
    const blocks = buildRelatedLinks({
      currentPath: '/x',
      categorySlug: 'eletricista',
      relatedCities: [
        { name: 'Baixa', slug: 'baixa', signals: { ctr: 0.01 } },
        { name: 'Alta', slug: 'alta', signals: { ctr: 0.2, isSponsored: true } },
        { name: 'Média', slug: 'media', signals: { ctr: 0.06 } },
      ],
    });
    const labels = blocks[0].links.map((l) => l.label);
    expect(labels[0]).toBe('Alta');
  });

  it('respeita MAX_LINK_DEPTH (descartando paths fundos)', () => {
    // Construímos links válidos; depth 3 (`/a/b/c`) é o máximo aceito.
    const blocks = buildRelatedLinks({
      currentPath: '/x',
      categorySlug: 'eletricista',
      relatedCities: [{ name: 'OK', slug: 'curitiba' }], // gera /categoria/eletricista/em/curitiba (depth 4) → DESCARTA
    });
    // Profundidade 4 ultrapassa MAX_LINK_DEPTH (3), então o bloco não é gerado.
    expect(blocks.length).toBe(0);
  });

  it('blocos com 0 links não aparecem', () => {
    const blocks = buildRelatedLinks({
      currentPath: '/x',
      categorySlug: 'eletricista',
      relatedCities: [],
    });
    expect(blocks).toEqual([]);
  });

  it('não cria link para si mesmo via thinPaths vazio', () => {
    const blocks = buildRelatedLinks({
      currentPath: '/categoria/eletricista',
      citySlug: 'curitiba',
      relatedCategories: [{ name: 'Eletricista', slug: 'eletricista' }],
    });
    const hrefs = blocks.flatMap((b) => b.links.map((l) => l.href));
    expect(hrefs).not.toContain('/categoria/eletricista');
  });
});
