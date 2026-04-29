/**
 * seo-breadcrumb-canonical-smoke.test.tsx
 *
 * Smoke tests SSR-like (jsdom) que validam, para as três rotas SEO chave:
 *   /categoria/{slug}, /cidade/{uf}/{cidade} e /profissional/{slug}
 *
 * 1) BreadcrumbList JSON-LD presente, parseável e bem-formado no DOM final.
 * 2) <link rel="canonical"> absoluto, coerente com a URL do BreadcrumbList
 *    (último item) e com o formato esperado nos sitemaps.
 *
 * Estratégia: chamamos `useSeoHead` e `useJsonLd` em renderHook (mesmo caminho
 * usado pelas páginas reais) — evita carregar páginas inteiras com Supabase,
 * Leaflet e auth, mantendo o teste rápido e estável. O contrato testado é o
 * mesmo que o crawler do Google enxerga.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

// Mock useSettingValue (evita network do useSiteSettings)
vi.mock('@/hooks/useSiteSettings', () => ({
  useSettingValue: () => null,
}));

function clearHead() {
  document.querySelectorAll('script[type="application/ld+json"]').forEach((n) => n.remove());
  document.querySelectorAll('link[rel="canonical"]').forEach((n) => n.remove());
}

function getCanonical(): string | null {
  const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  return link?.getAttribute('href') ?? null;
}

function getJsonLd(id: string): any | null {
  const node = document.getElementById(id);
  if (!node?.textContent) return null;
  return JSON.parse(node.textContent);
}

// Fábricas idênticas às usadas em breadcrumb-jsonld.test.tsx (mesmo contrato).
function categoryBreadcrumb(slug: string, name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Categorias', item: `${SITE_BASE_URL}/categorias` },
      { '@type': 'ListItem', position: 3, name, item: `${SITE_BASE_URL}/categoria/${slug}` },
    ],
  };
}
function cityBreadcrumb(uf: string, slug: string, name: string, stateName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Cidades', item: `${SITE_BASE_URL}/cidades` },
      { '@type': 'ListItem', position: 3, name: stateName, item: `${SITE_BASE_URL}/cidades/${uf}` },
      { '@type': 'ListItem', position: 4, name, item: `${SITE_BASE_URL}/cidades/${uf}/${slug}` },
    ],
  };
}
function providerBreadcrumb(slug: string, name: string, categorySlug: string, category: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: category, item: `${SITE_BASE_URL}/categoria/${categorySlug}` },
      { '@type': 'ListItem', position: 3, name, item: `${SITE_BASE_URL}/profissional/${slug}` },
    ],
  };
}

interface Case {
  label: string;
  path: string;
  ldId: string;
  ld: ReturnType<typeof categoryBreadcrumb>;
  expectedCanonical: string;
  /** URL que deveria aparecer também nos sitemaps daquele tipo. */
  expectedSitemapUrl: string;
}

const CASES: Case[] = [
  {
    label: '/categoria/{slug}',
    path: '/categoria/eletricista',
    ldId: 'smoke-breadcrumb-categoria',
    ld: categoryBreadcrumb('eletricista', 'Eletricista'),
    expectedCanonical: `${SITE_BASE_URL}/categoria/eletricista`,
    expectedSitemapUrl: `${SITE_BASE_URL}/categoria/eletricista`,
  },
  {
    label: '/cidades/{uf}/{cidade}',
    path: '/cidades/pr/curitiba',
    ldId: 'smoke-breadcrumb-cidade',
    ld: cityBreadcrumb('pr', 'curitiba', 'Curitiba', 'Paraná'),
    expectedCanonical: `${SITE_BASE_URL}/cidades/pr/curitiba`,
    expectedSitemapUrl: `${SITE_BASE_URL}/cidades/pr/curitiba`,
  },
  {
    label: '/profissional/{slug}',
    path: '/profissional/joao-silva',
    ldId: 'smoke-breadcrumb-profissional',
    ld: providerBreadcrumb('joao-silva', 'João Silva', 'eletricista', 'Eletricista'),
    expectedCanonical: `${SITE_BASE_URL}/profissional/joao-silva`,
    expectedSitemapUrl: `${SITE_BASE_URL}/profissional/joao-silva`,
  },
];

describe('SEO smoke — BreadcrumbList + canonical para rotas indexáveis', () => {
  beforeEach(() => {
    clearHead();
    // Simula o pathname (jsdom permite override via history.replaceState)
    window.history.replaceState({}, '', '/');
  });

  it.each(CASES)('$label injeta JSON-LD parseável e canonical absoluto coerente', (c) => {
    window.history.replaceState({}, '', c.path);

    renderHook(() => {
      useSeoHead({
        title: `Página de teste — ${c.label}`,
        description: 'Smoke test SEO — descrição válida com mais de 50 caracteres.',
        canonical: c.expectedCanonical,
      });
      useJsonLd(c.ld, c.ldId);
    });

    // 1) JSON-LD parseável
    const parsed = getJsonLd(c.ldId);
    expect(parsed, `${c.label}: JSON-LD ausente`).not.toBeNull();
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('BreadcrumbList');
    expect(Array.isArray(parsed.itemListElement)).toBe(true);

    // Itens posicionais sequenciais
    parsed.itemListElement.forEach((it: any, idx: number) => {
      expect(it['@type']).toBe('ListItem');
      expect(it.position).toBe(idx + 1);
    });

    // 2) Canonical absoluto coerente
    const canonical = getCanonical();
    expect(canonical).toBe(c.expectedCanonical);
    expect(canonical?.startsWith(SITE_BASE_URL)).toBe(true);

    // 3) Coerência canonical ↔ último item do breadcrumb ↔ URL do sitemap
    const last = parsed.itemListElement[parsed.itemListElement.length - 1];
    expect(last.item).toBe(c.expectedSitemapUrl);
    expect(last.item).toBe(canonical);
  });

  it('canonical fallback usa SITE_BASE_URL + pathname quando não passado explícito', () => {
    window.history.replaceState({}, '', '/categoria/pintor');

    renderHook(() =>
      useSeoHead({
        title: 'Pintor',
        description: 'Encontre profissionais de pintura próximos de você no Brasil inteiro.',
      }),
    );

    expect(getCanonical()).toBe(`${SITE_BASE_URL}/categoria/pintor`);
  });
});
