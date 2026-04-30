/**
 * Cobre as regras de SEO da página /buscar:
 *  - canonical é estável (sem page/disponivel)
 *  - rel=prev/next são montados a partir dos searchParams atuais
 *  - noindex é ligado em page>1 e em disponivel ≠ any
 *
 * Replicamos a lógica pura usada em SearchPage.tsx para validar sem montar
 * a página inteira (que depende de Supabase/Geo).
 */
import { describe, it, expect } from 'vitest';

const SITE_BASE_URL = 'https://precisodeum.com.br';
const ITEMS_PER_PAGE = 12;

interface State {
  query?: string;
  selectedCategory?: string;
  seoCity?: string;
  sortBy?: string;
  page: number;
  totalDisplay: number;
  availabilityWindow: 'any' | 'today' | 'this_week' | 'recent';
}

function buildCanonical(s: State) {
  const params = new URLSearchParams();
  if (s.query) params.set('q', s.query);
  if (s.selectedCategory) params.set('categoria', s.selectedCategory);
  if (s.seoCity) params.set('cidade', s.seoCity);
  if (s.sortBy && s.sortBy !== 'relevance') params.set('ordem', s.sortBy);
  const qs = params.toString();
  return `${SITE_BASE_URL}/buscar${qs ? `?${qs}` : ''}`;
}

function buildPagedUrl(searchParams: URLSearchParams, targetPage: number) {
  const params = new URLSearchParams(searchParams);
  if (targetPage > 1) params.set('page', String(targetPage));
  else params.delete('page');
  const qs = params.toString();
  return `${SITE_BASE_URL}/buscar${qs ? `?${qs}` : ''}`;
}

function computeNoindex(s: State) {
  return (
    (!s.query && !s.selectedCategory && !s.seoCity) ||
    s.page > 1 ||
    s.availabilityWindow !== 'any'
  );
}

describe('SearchPage SEO (canonical + prev/next + noindex)', () => {
  it('canonical não inclui page nem disponivel', () => {
    const s: State = {
      query: 'eletricista',
      selectedCategory: 'eletricista',
      seoCity: 'Curitiba',
      sortBy: 'rating',
      page: 3,
      totalDisplay: 60,
      availabilityWindow: 'today',
    };
    const c = buildCanonical(s);
    expect(c).toBe(
      `${SITE_BASE_URL}/buscar?q=eletricista&categoria=eletricista&cidade=Curitiba&ordem=rating`,
    );
    expect(c).not.toMatch(/page=/);
    expect(c).not.toMatch(/disponivel=/);
  });

  it('canonical de busca vazia é apenas /buscar', () => {
    expect(
      buildCanonical({ page: 1, totalDisplay: 0, availabilityWindow: 'any' } as State),
    ).toBe(`${SITE_BASE_URL}/buscar`);
  });

  it('prev/next refletem a navegação real (com page e filtros)', () => {
    const sp = new URLSearchParams({ categoria: 'eletricista', cidade: 'Curitiba', page: '3' });
    const totalPages = Math.max(1, Math.ceil(60 / ITEMS_PER_PAGE)); // 5
    const page = 3;
    const prev = page > 1 ? buildPagedUrl(sp, page - 1) : undefined;
    const next = page < totalPages ? buildPagedUrl(sp, page + 1) : undefined;
    expect(prev).toBe(`${SITE_BASE_URL}/buscar?categoria=eletricista&cidade=Curitiba&page=2`);
    expect(next).toBe(`${SITE_BASE_URL}/buscar?categoria=eletricista&cidade=Curitiba&page=4`);
  });

  it('prev é omitido na primeira página e next na última', () => {
    const sp = new URLSearchParams({ categoria: 'eletricista' });
    const totalPages = Math.max(1, Math.ceil(24 / ITEMS_PER_PAGE)); // 2

    const first = { page: 1 };
    const prev1 = first.page > 1 ? buildPagedUrl(sp, first.page - 1) : undefined;
    const next1 = first.page < totalPages ? buildPagedUrl(sp, first.page + 1) : undefined;
    expect(prev1).toBeUndefined();
    expect(next1).toBe(`${SITE_BASE_URL}/buscar?categoria=eletricista&page=2`);

    const last = { page: 2 };
    const prev2 = last.page > 1 ? buildPagedUrl(sp, last.page - 1) : undefined;
    const next2 = last.page < totalPages ? buildPagedUrl(sp, last.page + 1) : undefined;
    expect(prev2).toBe(`${SITE_BASE_URL}/buscar?categoria=eletricista`);
    expect(next2).toBeUndefined();
  });

  it('noindex liga em /buscar sem recorte editorial', () => {
    expect(
      computeNoindex({ page: 1, totalDisplay: 0, availabilityWindow: 'any' } as State),
    ).toBe(true);
  });

  it('noindex liga quando page > 1', () => {
    expect(
      computeNoindex({
        selectedCategory: 'eletricista',
        seoCity: 'Curitiba',
        page: 2,
        totalDisplay: 30,
        availabilityWindow: 'any',
      } as State),
    ).toBe(true);
  });

  it('noindex liga quando há filtro de disponibilidade', () => {
    expect(
      computeNoindex({
        selectedCategory: 'eletricista',
        page: 1,
        totalDisplay: 30,
        availabilityWindow: 'today',
      } as State),
    ).toBe(true);
  });

  it('noindex desliga em página 1 com recorte editorial e sem filtros voláteis', () => {
    expect(
      computeNoindex({
        selectedCategory: 'eletricista',
        seoCity: 'Curitiba',
        page: 1,
        totalDisplay: 30,
        availabilityWindow: 'any',
      } as State),
    ).toBe(false);
  });
});
