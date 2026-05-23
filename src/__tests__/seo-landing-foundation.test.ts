import { describe, it, expect } from 'vitest';
import {
  computeSitemapPriority,
  getSeoRoute,
  SEO_ROUTE_REGISTRY,
} from '@/lib/seoRouteRegistry';
import {
  evaluateLandingEligibility,
  isValidSeoSlug,
} from '@/lib/seoLandingEligibility';
import {
  buildRelatedLinks,
  MAX_BLOCKS,
  MAX_LINKS_PER_BLOCK,
} from '@/lib/seoInternalLinking';

describe('seoRouteRegistry', () => {
  it('expõe todos os tipos de landing', () => {
    expect(Object.keys(SEO_ROUTE_REGISTRY)).toEqual(
      expect.arrayContaining([
        'home',
        'city',
        'category',
        'category_city',
        'service',
        'urgency',
        'neighborhood',
        'comparison',
      ]),
    );
  });

  it('category_city tem maior prioridade que city e category', () => {
    expect(getSeoRoute('category_city').basePriority).toBeGreaterThan(
      getSeoRoute('city').basePriority,
    );
    expect(getSeoRoute('category_city').basePriority).toBeGreaterThan(
      getSeoRoute('category').basePriority,
    );
  });

  it('penaliza prioridade quando providers abaixo do mínimo', () => {
    const high = computeSitemapPriority('category_city', { providers: 5, healthy: true });
    const low = computeSitemapPriority('category_city', { providers: 0 });
    expect(low).toBeLessThan(high);
  });

  it('eleva prioridade quando sponsored + healthy', () => {
    const base = computeSitemapPriority('category', { providers: 3 });
    const boosted = computeSitemapPriority('category', {
      providers: 3,
      sponsored: true,
      healthy: true,
    });
    expect(boosted).toBeGreaterThan(base);
    expect(boosted).toBeLessThanOrEqual(1);
  });
});

describe('seoLandingEligibility', () => {
  it('aceita slugs válidos e rejeita inválidos', () => {
    expect(isValidSeoSlug('eletricista-curitiba')).toBe(true);
    expect(isValidSeoSlug('a')).toBe(false);
    expect(isValidSeoSlug('Slug-Invalido')).toBe(false);
    expect(isValidSeoSlug('')).toBe(false);
    expect(isValidSeoSlug(undefined)).toBe(false);
  });

  it('marca thin quando não há providers em rota que exige', () => {
    const v = evaluateLandingEligibility({
      type: 'category_city',
      slug: 'eletricista',
      citySlug: 'curitiba',
      categorySlug: 'eletricista',
      providersCount: 0,
    });
    expect(v.indexable).toBe(false);
    expect(v.status).toBe('thin');
    expect(v.robots).toBe('noindex, follow');
    expect(v.reasons).toContain('no_providers');
  });

  it('marca healthy quando providers suficientes e slug válido', () => {
    const v = evaluateLandingEligibility({
      type: 'category_city',
      slug: 'eletricista',
      citySlug: 'curitiba',
      categorySlug: 'eletricista',
      providersCount: 10,
    });
    expect(v.indexable).toBe(true);
    expect(v.status).toBe('healthy');
    expect(v.robots).toBe('index, follow');
  });

  it('classifica high_conversion quando CTR ≥ 4%', () => {
    const v = evaluateLandingEligibility({
      type: 'category_city',
      slug: 'eletricista',
      citySlug: 'curitiba',
      categorySlug: 'eletricista',
      providersCount: 5,
      conversionRate: 0.05,
    });
    expect(v.status).toBe('high_conversion');
  });

  it('rejeita slug inválido mesmo com providers', () => {
    const v = evaluateLandingEligibility({
      type: 'category',
      slug: 'A_inválido',
      providersCount: 50,
    });
    expect(v.indexable).toBe(false);
    expect(v.reasons).toContain('invalid_slug');
  });
});

describe('seoInternalLinking', () => {
  it('respeita limites de blocos e links por bloco', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      name: `Cidade ${i}`,
      slug: `cidade-${i}`,
    }));
    const blocks = buildRelatedLinks({
      currentPath: '/categoria/eletricista/em/curitiba',
      categorySlug: 'eletricista',
      citySlug: 'curitiba',
      relatedCities: many,
      relatedCategories: many.map((c) => ({ name: c.name, slug: c.slug })),
      relatedNeighborhoods: many.map((c) => ({ name: c.name, slug: c.slug })),
    });
    expect(blocks.length).toBeLessThanOrEqual(MAX_BLOCKS);
    for (const b of blocks) {
      expect(b.links.length).toBeLessThanOrEqual(MAX_LINKS_PER_BLOCK);
    }
  });

  it('exclui o path atual dos links gerados', () => {
    const blocks = buildRelatedLinks({
      currentPath: '/categoria/eletricista/em/curitiba',
      categorySlug: 'eletricista',
      relatedCities: [
        { name: 'Curitiba', slug: 'curitiba' },
        { name: 'São Paulo', slug: 'sao-paulo' },
      ],
    });
    const flat = blocks.flatMap((b) => b.links.map((l) => l.href));
    expect(flat).not.toContain('/categoria/eletricista/em/curitiba');
    expect(flat).toContain('/categoria/eletricista/em/sao-paulo');
  });

  it('descarta slugs inválidos silenciosamente', () => {
    const blocks = buildRelatedLinks({
      currentPath: '/categoria/eletricista',
      categorySlug: 'eletricista',
      relatedCities: [
        { name: 'OK', slug: 'cidade-ok' },
        { name: 'Ruim', slug: 'Cidade_Ruim' },
      ],
    });
    const hrefs = blocks.flatMap((b) => b.links.map((l) => l.href));
    expect(hrefs).toContain('/categoria/eletricista/em/cidade-ok');
    expect(hrefs.some((h) => h.includes('Cidade_Ruim'))).toBe(false);
  });
});
