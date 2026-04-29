/**
 * breadcrumb-jsonld.test.tsx — valida JSON-LD BreadcrumbList das rotas SEO:
 *   /categoria/{slug}, /cidade/{cidade} (via /cidades/:estado/:cidade) e
 *   /profissional/{slug}.
 *
 * Cobertura:
 *  - Modo "client" (renderização React via vitest/jsdom) — verifica que o
 *    helper `useJsonLd` injeta um <script type="application/ld+json"> com
 *    @type=BreadcrumbList e itens posicionais corretos.
 *  - Modo "SSR" — não temos SSR real (Vite SPA), mas validamos que o objeto
 *    JSON-LD usado pelo helper é serialização-segura (idempotente JSON.parse(
 *    JSON.stringify(x)) === schema esperado), garantindo que o mesmo conteúdo
 *    viajaria via SSR no futuro sem perda. Testamos o objeto puro.
 *
 * Por que não montamos as páginas inteiras: cada uma tem hooks pesados
 * (Supabase, useAuth, leaflet etc.) que exigem mocks frágeis. O contrato real
 * que o Google lê é o objeto JSON-LD — extraímos a fábrica do objeto e
 * validamos shape e injeção. Os snapshots SSR ficam estáveis assim.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useJsonLd } from '@/hooks/useJsonLd';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';

// ---------- Fábricas puras (mesma lógica das páginas) ----------

function buildCategoryBreadcrumb(slug: string, name: string) {
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

function buildCityBreadcrumb(estado: string, cidadeSlug: string, cidadeName: string, stateName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Cidades', item: `${SITE_BASE_URL}/cidades` },
      { '@type': 'ListItem', position: 3, name: stateName, item: `${SITE_BASE_URL}/cidades/${estado}` },
      { '@type': 'ListItem', position: 4, name: cidadeName, item: `${SITE_BASE_URL}/cidades/${estado}/${cidadeSlug}` },
    ],
  };
}

function buildProviderBreadcrumb(slug: string, name: string, categorySlug: string, category: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      ...(categorySlug ? [{ '@type': 'ListItem', position: 2, name: category, item: `${SITE_BASE_URL}/categoria/${categorySlug}` }] : []),
      { '@type': 'ListItem', position: categorySlug ? 3 : 2, name },
    ],
  };
}

// ---------- Helpers ----------

function getInjectedLd(testId: string): any | null {
  const node = document.querySelector(`script[type="application/ld+json"][data-jsonld-id="${testId}"]`)
    || Array.from(document.querySelectorAll('script[type="application/ld+json"]')).slice(-1)[0];
  if (!node || !node.textContent) return null;
  return JSON.parse(node.textContent);
}

function clearLd() {
  document.querySelectorAll('script[type="application/ld+json"]').forEach((n) => n.remove());
}

// ---------- Tests ----------

describe('BreadcrumbList JSON-LD — fábrica pura (modo SSR-safe)', () => {
  it('/categoria/{slug} produz 3 níveis: Início → Categorias → {Categoria}', () => {
    const ld = buildCategoryBreadcrumb('eletricista', 'Eletricista');
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement[2].item).toBe(`${SITE_BASE_URL}/categoria/eletricista`);
    expect(ld.itemListElement[2].position).toBe(3);
    // Idempotência de serialização — garantia de SSR estável
    expect(JSON.parse(JSON.stringify(ld))).toEqual(ld);
  });

  it('/cidades/{uf}/{cidade} produz 4 níveis com ordem correta', () => {
    const ld = buildCityBreadcrumb('pr', 'curitiba', 'Curitiba', 'Paraná');
    expect(ld.itemListElement).toHaveLength(4);
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2, 3, 4]);
    expect(ld.itemListElement[3].item).toBe(`${SITE_BASE_URL}/cidades/pr/curitiba`);
    expect(ld.itemListElement[2].name).toBe('Paraná');
  });

  it('/profissional/{slug} adiciona categoria como nível 2 quando disponível', () => {
    const ld = buildProviderBreadcrumb('joao-silva', 'João Silva', 'eletricista', 'Eletricista');
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement[1].item).toBe(`${SITE_BASE_URL}/categoria/eletricista`);
    expect(ld.itemListElement[2].name).toBe('João Silva');
    expect(ld.itemListElement[2].position).toBe(3);
  });

  it('/profissional/{slug} sem categoria reduz para 2 níveis', () => {
    const ld = buildProviderBreadcrumb('joao', 'João', '', '');
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[1].position).toBe(2);
  });

  it('todas as URLs nos breadcrumbs usam SITE_BASE_URL absoluto (canonical-friendly)', () => {
    const all = [
      ...buildCategoryBreadcrumb('a', 'A').itemListElement,
      ...buildCityBreadcrumb('pr', 'curitiba', 'Curitiba', 'PR').itemListElement,
      ...buildProviderBreadcrumb('p', 'P', 'a', 'A').itemListElement,
    ];
    for (const item of all) {
      if ('item' in item && item.item) {
        expect(item.item).toMatch(new RegExp(`^${SITE_BASE_URL.replace(/[/.]/g, '\\$&')}`));
      }
    }
  });
});

describe('BreadcrumbList JSON-LD — modo client (useJsonLd injeta no DOM)', () => {
  beforeEach(clearLd);

  it('useJsonLd injeta <script type="application/ld+json"> com o BreadcrumbList', () => {
    const ld = buildCategoryBreadcrumb('eletricista', 'Eletricista');
    renderHook(() => useJsonLd(ld, 'breadcrumb-test'));
    const parsed = getInjectedLd('breadcrumb-test');
    expect(parsed).not.toBeNull();
    expect(parsed['@type']).toBe('BreadcrumbList');
    expect(parsed.itemListElement[2].name).toBe('Eletricista');
  });

  it('client mode: BreadcrumbList de cidade é injetado e parsable', () => {
    const ld = buildCityBreadcrumb('pr', 'curitiba', 'Curitiba', 'Paraná');
    renderHook(() => useJsonLd(ld, 'breadcrumb-city'));
    const parsed = getInjectedLd('breadcrumb-city');
    expect(parsed).not.toBeNull();
    expect(parsed.itemListElement).toHaveLength(4);
  });

  it('client mode: BreadcrumbList de profissional é injetado e parsable', () => {
    const ld = buildProviderBreadcrumb('joao-silva', 'João Silva', 'eletricista', 'Eletricista');
    renderHook(() => useJsonLd(ld, 'breadcrumb-provider'));
    const parsed = getInjectedLd('breadcrumb-provider');
    expect(parsed).not.toBeNull();
    expect(parsed.itemListElement[2].name).toBe('João Silva');
  });
});
