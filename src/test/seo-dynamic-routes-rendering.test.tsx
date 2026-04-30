/**
 * seo-dynamic-routes-rendering.test.tsx
 *
 * Garantia de renderização SEO para rotas dinâmicas críticas:
 *   - /categoria/:slug
 *   - /cidade/:slug  e  /cidades/:uf/:cidade
 *   - /profissional/:slug
 *   - /categoria/:slug/em/:cidade
 *   - /especialidades/:slug
 *
 * Estratégia: exercitamos diretamente `useSeoHead` + `useJsonLd` com payloads
 * representativos de cada rota e validamos o DOM resultante. Isso garante,
 * em CI, que qualquer regressão (remoção de canonical, perda de og:*, falta
 * de JSON-LD, robots inválido) seja detectada antes do deploy.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useSeoHead } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import {
  getCategorySeoMeta,
  getEspecialidadeSeoMeta,
  getCategoryBreadcrumbs,
} from '@/lib/categorySeo';

// Evita dependência de Supabase nos hooks de settings.
vi.mock('@/hooks/useSiteSettings', () => ({ useSettingValue: () => null }));

function clearHead() {
  document
    .querySelectorAll(
      'link[rel="canonical"], meta[name], meta[property], script[type="application/ld+json"]',
    )
    .forEach((n) => n.remove());
  document.title = '';
}

const getMeta = (name: string, attr: 'name' | 'property' = 'name') =>
  (document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null)?.content ?? null;

const getCanonical = () =>
  (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href ?? null;

const getJsonLdByType = (type: string) => {
  const scripts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  ) as HTMLScriptElement[];
  for (const s of scripts) {
    try {
      const parsed = JSON.parse(s.textContent || 'null');
      if (parsed && parsed['@type'] === type) return parsed;
    } catch {
      /* ignore */
    }
  }
  return null;
};

function expectFullSeoSurface({
  expectedTitleIncludes,
  expectedCanonicalEndsWith,
  expectedOgType = 'website',
  expectIndexable = true,
}: {
  expectedTitleIncludes: string;
  expectedCanonicalEndsWith: string;
  expectedOgType?: string;
  expectIndexable?: boolean;
}) {
  // Title sempre com sufixo de marca.
  expect(document.title).toContain('Preciso de um');
  expect(document.title.toLowerCase()).toContain(expectedTitleIncludes.toLowerCase());

  // Description não vazia e ≥ 50 chars.
  const desc = getMeta('description');
  expect(desc).toBeTruthy();
  expect((desc || '').length).toBeGreaterThanOrEqual(50);

  // Robots coerente com indexação.
  expect(getMeta('robots')).toBe(
    expectIndexable ? 'index, follow' : 'noindex, nofollow',
  );

  // Canonical absoluto.
  const canonical = getCanonical();
  expect(canonical).toMatch(/^https:\/\//);
  expect(canonical?.endsWith(expectedCanonicalEndsWith)).toBe(true);

  // Open Graph essenciais.
  expect(getMeta('og:title', 'property')).toContain('Preciso de um');
  expect(getMeta('og:description', 'property')).toBe(desc);
  expect(getMeta('og:type', 'property')).toBe(expectedOgType);
  expect(getMeta('og:image', 'property')).toMatch(/^https?:\/\//);
  expect(getMeta('og:site_name', 'property')).toBe('Preciso de um');
  expect(getMeta('og:locale', 'property')).toBe('pt_BR');

  // Twitter Card.
  expect(getMeta('twitter:card')).toBe('summary_large_image');
  expect(getMeta('twitter:title')).toContain('Preciso de um');
  expect(getMeta('twitter:description')).toBe(desc);
  expect(getMeta('twitter:image')).toMatch(/^https?:\/\//);
}

describe('SEO — rotas dinâmicas emitem metatags completas', () => {
  beforeEach(() => clearHead());
  afterEach(() => cleanup());

  it('/categoria/:slug → title + canonical + OG + Twitter + JSON-LD BreadcrumbList', () => {
    const meta = getCategorySeoMeta({
      slug: 'eletricista',
      category: { name: 'Eletricista', slug: 'eletricista' },
      providersCount: 42,
    });

    renderHook(() => {
      useSeoHead({
        title: meta.title,
        description: meta.description,
        canonical: meta.canonical,
        noindex: meta.noindex,
      });
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: getCategoryBreadcrumbs({
            slug: 'eletricista',
            category: { name: 'Eletricista', slug: 'eletricista' },
          }).map((b, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: b.name,
            item: b.url,
          })),
        },
        'breadcrumb-categoria',
      );
    });

    expectFullSeoSurface({
      expectedTitleIncludes: 'eletricista',
      expectedCanonicalEndsWith: '/categoria/eletricista',
    });
    const breadcrumb = getJsonLdByType('BreadcrumbList');
    expect(breadcrumb).toBeTruthy();
    expect(Array.isArray(breadcrumb.itemListElement)).toBe(true);
    expect(breadcrumb.itemListElement.length).toBeGreaterThanOrEqual(2);
  });

  it('/categoria/:slug ausente → noindex + canonical preservado', () => {
    const meta = getCategorySeoMeta({ slug: 'inexistente', category: null });
    renderHook(() =>
      useSeoHead({
        title: meta.title,
        description: meta.description,
        canonical: meta.canonical,
        noindex: meta.noindex,
      }),
    );
    expect(getMeta('robots')).toBe('noindex, nofollow');
    expect(getCanonical()).toMatch(/\/categoria\/inexistente$/);
  });

  it('/cidade/:slug → emite OG + canonical absoluto + JSON-LD Place', () => {
    renderHook(() => {
      useSeoHead({
        title: 'Profissionais em São Paulo',
        description:
          'Encontre profissionais verificados em São Paulo com avaliações reais e contato direto pelo WhatsApp.',
        canonical: 'https://precisodeum.com.br/cidade/sao-paulo',
      });
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: 'São Paulo',
          address: { '@type': 'PostalAddress', addressLocality: 'São Paulo', addressCountry: 'BR' },
        },
        'place-cidade',
      );
    });
    expectFullSeoSurface({
      expectedTitleIncludes: 'são paulo',
      expectedCanonicalEndsWith: '/cidade/sao-paulo',
    });
    expect(getJsonLdByType('Place')).toBeTruthy();
  });

  it('/cidades/:uf/:cidade → canonical aninhado + Breadcrumb', () => {
    renderHook(() => {
      useSeoHead({
        title: 'Profissionais em Curitiba - PR',
        description:
          'Veja todos os profissionais cadastrados em Curitiba (PR), com avaliações, especialidades e contato direto.',
        canonical: 'https://precisodeum.com.br/cidades/pr/curitiba',
      });
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://precisodeum.com.br/' },
            { '@type': 'ListItem', position: 2, name: 'Cidades', item: 'https://precisodeum.com.br/cidades' },
            { '@type': 'ListItem', position: 3, name: 'Curitiba', item: 'https://precisodeum.com.br/cidades/pr/curitiba' },
          ],
        },
        'breadcrumb-cidade-detail',
      );
    });
    expectFullSeoSurface({
      expectedTitleIncludes: 'curitiba',
      expectedCanonicalEndsWith: '/cidades/pr/curitiba',
    });
    const bc = getJsonLdByType('BreadcrumbList');
    expect(bc.itemListElement).toHaveLength(3);
  });

  it('/profissional/:slug → og:type=profile + JSON-LD Person/LocalBusiness', () => {
    renderHook(() => {
      useSeoHead({
        title: 'João Silva - Eletricista em São Paulo',
        description:
          'João Silva é eletricista verificado em São Paulo com 5 anos de experiência. Veja avaliações e entre em contato.',
        canonical: 'https://precisodeum.com.br/profissional/joao-silva-sp',
        ogType: 'profile',
      });
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: 'João Silva',
          jobTitle: 'Eletricista',
        },
        'person-provider',
      );
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: 'João Silva - Eletricista',
          address: { '@type': 'PostalAddress', addressLocality: 'São Paulo' },
        },
        'localbusiness-provider',
      );
    });
    expectFullSeoSurface({
      expectedTitleIncludes: 'joão silva',
      expectedCanonicalEndsWith: '/profissional/joao-silva-sp',
      expectedOgType: 'profile',
    });
    expect(getJsonLdByType('Person')).toBeTruthy();
    expect(getJsonLdByType('LocalBusiness')).toBeTruthy();
  });

  it('/categoria/:slug/em/:cidade → canonical próprio + meta completa', () => {
    const meta = getCategorySeoMeta({
      slug: 'eletricista',
      category: { name: 'Eletricista', slug: 'eletricista' },
      city: 'Curitiba',
      providersCount: 12,
    });
    renderHook(() =>
      useSeoHead({
        title: meta.title,
        description: meta.description,
        canonical: 'https://precisodeum.com.br/categoria/eletricista/em/curitiba',
        noindex: false,
      }),
    );
    expectFullSeoSurface({
      expectedTitleIncludes: 'curitiba',
      expectedCanonicalEndsWith: '/categoria/eletricista/em/curitiba',
    });
    expect(getMeta('description')).toContain('Curitiba');
  });

  it('/especialidades/:slug → reutiliza helper e mantém canonical estável', () => {
    const meta = getEspecialidadeSeoMeta({
      slug: 'pintor',
      category: { name: 'Pintor', slug: 'pintor' },
    });
    renderHook(() =>
      useSeoHead({
        title: meta.title,
        description: meta.description,
        canonical: meta.canonical,
        noindex: meta.noindex,
      }),
    );
    expectFullSeoSurface({
      expectedTitleIncludes: 'pintor',
      expectedCanonicalEndsWith: '/especialidades/pintor',
    });
  });

  it('og:image, twitter:image e dimensões 1200x630 sempre presentes', () => {
    renderHook(() =>
      useSeoHead({
        title: 'Teste imagens sociais',
        description:
          'Garantindo que as metatags de imagem social estão presentes para todas as rotas dinâmicas.',
        canonical: 'https://precisodeum.com.br/categoria/teste',
      }),
    );
    expect(getMeta('og:image', 'property')).toMatch(/^https?:\/\//);
    expect(getMeta('og:image:width', 'property')).toBe('1200');
    expect(getMeta('og:image:height', 'property')).toBe('630');
    expect(getMeta('twitter:image')).toMatch(/^https?:\/\//);
    expect(getMeta('twitter:card')).toBe('summary_large_image');
  });
});
