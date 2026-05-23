import { describe, it, expect } from 'vitest';
import {
  shouldIndex,
  shouldNoindex,
  shouldCanonicalize,
  normalizeCanonicalPath,
} from '@/lib/seo/seoIndexationGuard';

describe('seoIndexationGuard', () => {
  it('indexa category_city saudável', () => {
    const v = shouldIndex({
      type: 'category_city',
      path: '/categoria/eletricista/em/curitiba',
      slug: 'eletricista',
      categorySlug: 'eletricista',
      citySlug: 'curitiba',
      providersCount: 12,
    });
    expect(v.index).toBe(true);
    expect(v.robots).toBe('index, follow');
  });

  it('noindex em página sem providers', () => {
    const v = shouldNoindex({
      type: 'category_city',
      path: '/categoria/x/em/y',
      slug: 'x',
      categorySlug: 'x',
      citySlug: 'y',
      providersCount: 0,
    });
    expect(v.noindex).toBe(true);
    expect(v.reasons).toContain('no_providers');
  });

  it('noindex em busca vazia', () => {
    const v = shouldNoindex({
      type: 'city',
      path: '/buscar?categoria=lixo',
      emptySearch: true,
      providersCount: 5,
      citySlug: 'curitiba',
    });
    expect(v.noindex).toBe(true);
    expect(v.reasons).toContain('empty_search');
  });

  it('noindex em rota desconhecida / parâmetros inválidos', () => {
    const v = shouldIndex({
      type: 'category',
      path: '/categoria/INVALID',
      slug: 'INVALID',
      categorySlug: 'INVALID',
      providersCount: 5,
      invalidParams: true,
      unknownRoute: true,
    });
    expect(v.index).toBe(false);
    expect(v.reasons).toEqual(expect.arrayContaining(['unknown_route', 'invalid_params']));
  });

  it('noindex em página órfã indexável', () => {
    const v = shouldNoindex({
      type: 'category',
      path: '/categoria/eletricista',
      slug: 'eletricista',
      categorySlug: 'eletricista',
      providersCount: 5,
      isOrphan: true,
    });
    expect(v.noindex).toBe(true);
    expect(v.reasons).toContain('orphan_page');
  });

  it('noindex quando providersCount < minProviders', () => {
    const v = shouldNoindex({
      type: 'urgency',
      path: '/urgencia/eletricista/em/curitiba',
      slug: 'eletricista',
      providersCount: 1, // urgency requer >=2
    });
    expect(v.noindex).toBe(true);
    expect(v.reasons).toContain('below_minimum_providers');
  });

  it('normalizeCanonicalPath remove query e trailing slash', () => {
    expect(normalizeCanonicalPath('/Categoria/Eletricista/?utm=x')).toBe('/categoria/eletricista');
    expect(normalizeCanonicalPath('/categoria//eletricista//')).toBe('/categoria/eletricista');
    expect(normalizeCanonicalPath('')).toBe('/');
  });

  it('shouldCanonicalize devolve canonical normalizado', () => {
    expect(
      shouldCanonicalize({
        type: 'category',
        path: '/Categoria/Eletricista?utm=1',
      }),
    ).toBe('/categoria/eletricista');
  });

  it('shouldIndex preserva canonicalPath mesmo quando noindex', () => {
    const v = shouldIndex({
      type: 'category',
      path: '/Categoria/X?ref=1',
      slug: 'X',
      categorySlug: 'X',
      invalidParams: true,
      providersCount: 0,
    });
    expect(v.canonicalPath).toBe('/categoria/x');
    expect(v.index).toBe(false);
  });

  it('home com requiresProviders=false continua indexável', () => {
    const v = shouldIndex({
      type: 'home',
      path: '/',
      providersCount: 0,
    });
    expect(v.index).toBe(true);
  });
});
