/**
 * seo-initial-html-ssr-rendering.test.tsx
 *
 * Garante que as metatags críticas de SEO ficam presentes no HTML inicial
 * (estado equivalente a SSR/SSG após a primeira pintura) para as rotas
 * dinâmicas /cidade, /categoria e /profissional.
 *
 * Em apps Vite SPA não há SSR real, mas crawlers modernos (Googlebot,
 * Bingbot, Twitterbot, Slackbot) executam JS antes de capturar tags.
 * Este teste reproduz esse momento: monta o hook UMA vez e serializa o
 * <head> resultante, validando o HTML como ele seria entregue ao crawler.
 *
 * Diferente do `seo-dynamic-routes-rendering.test.tsx` (que valida APIs do
 * DOM individualmente), aqui inspecionamos o HTML serializado — o mesmo
 * formato usado em fetch de bots — para detectar regressões de injeção.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useSeoHead } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';

vi.mock('@/hooks/useSiteSettings', () => ({ useSettingValue: () => null }));

function clearHead() {
  document
    .querySelectorAll(
      'link[rel="canonical"], meta[name], meta[property], script[type="application/ld+json"]',
    )
    .forEach((n) => n.remove());
  document.title = '';
}

/**
 * Snapshot do <head> serializado, simulando o que um crawler veria após
 * a hidratação inicial. Inclui também <title> que não está em head.innerHTML
 * por padrão em alguns runtimes jsdom.
 */
function serializeHead(): string {
  const titleTag = `<title>${document.title}</title>`;
  return titleTag + '\n' + document.head.innerHTML;
}

interface RouteFixture {
  label: string;
  path: string;
  setup: () => void;
  expectations: {
    titleContains: string;
    canonicalEndsWith: string;
    descriptionContains: string;
    ogType: string;
    jsonLdTypes: string[];
  };
}

const fixtures: RouteFixture[] = [
  {
    label: '/categoria/:slug',
    path: '/categoria/eletricista',
    setup: () => {
      useSeoHead({
        title: 'Eletricista no Brasil - Profissionais Verificados',
        description:
          'Encontre os melhores profissionais verificados de Eletricista no Brasil, com avaliações reais e contato direto.',
        canonical: 'https://precisodeum.com.br/categoria/eletricista',
      });
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://precisodeum.com.br/' },
            { '@type': 'ListItem', position: 2, name: 'Categorias', item: 'https://precisodeum.com.br/categorias' },
            { '@type': 'ListItem', position: 3, name: 'Eletricista', item: 'https://precisodeum.com.br/categoria/eletricista' },
          ],
        },
        'breadcrumb-cat-ssr',
      );
    },
    expectations: {
      titleContains: 'Eletricista',
      canonicalEndsWith: '/categoria/eletricista',
      descriptionContains: 'Eletricista',
      ogType: 'website',
      jsonLdTypes: ['BreadcrumbList'],
    },
  },
  {
    label: '/cidade/:slug',
    path: '/cidade/sao-paulo',
    setup: () => {
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
        'place-ssr',
      );
    },
    expectations: {
      titleContains: 'São Paulo',
      canonicalEndsWith: '/cidade/sao-paulo',
      descriptionContains: 'São Paulo',
      ogType: 'website',
      jsonLdTypes: ['Place'],
    },
  },
  {
    label: '/profissional/:slug',
    path: '/profissional/joao-silva-sp',
    setup: () => {
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
        'person-ssr',
      );
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: 'João Silva - Eletricista',
          address: { '@type': 'PostalAddress', addressLocality: 'São Paulo' },
        },
        'localbusiness-ssr',
      );
    },
    expectations: {
      titleContains: 'João Silva',
      canonicalEndsWith: '/profissional/joao-silva-sp',
      descriptionContains: 'João Silva',
      ogType: 'profile',
      jsonLdTypes: ['Person', 'LocalBusiness'],
    },
  },
];

describe('SEO — HTML inicial entregue a crawlers (SSR-equivalent)', () => {
  beforeEach(() => clearHead());
  afterEach(() => cleanup());

  it.each(fixtures)('$label produz <head> serializado válido para crawlers', (fx) => {
    renderHook(() => fx.setup());
    const html = serializeHead();

    // Title
    expect(html).toContain(`<title>`);
    expect(html.toLowerCase()).toContain(fx.expectations.titleContains.toLowerCase());
    expect(html).toContain('Preciso de um');

    // Canonical absoluto e correto
    const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
    expect(canonicalMatch, 'canonical ausente no HTML inicial').toBeTruthy();
    expect(canonicalMatch![1]).toMatch(/^https:\/\//);
    expect(canonicalMatch![1].endsWith(fx.expectations.canonicalEndsWith)).toBe(true);

    // Description não vazia
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/);
    expect(descMatch, 'meta description ausente').toBeTruthy();
    expect(descMatch![1].length).toBeGreaterThanOrEqual(50);
    expect(descMatch![1]).toContain(fx.expectations.descriptionContains);

    // Robots indexável
    expect(html).toMatch(/<meta[^>]+name="robots"[^>]+content="index,\s*follow"/);

    // Open Graph
    expect(html).toMatch(/<meta[^>]+property="og:title"/);
    expect(html).toMatch(/<meta[^>]+property="og:description"/);
    expect(html).toMatch(new RegExp(`<meta[^>]+property="og:type"[^>]+content="${fx.expectations.ogType}"`));
    expect(html).toMatch(/<meta[^>]+property="og:url"[^>]+content="https:\/\//);
    expect(html).toMatch(/<meta[^>]+property="og:image"[^>]+content="https?:\/\//);
    expect(html).toMatch(/<meta[^>]+property="og:image:width"[^>]+content="1200"/);
    expect(html).toMatch(/<meta[^>]+property="og:image:height"[^>]+content="630"/);

    // Twitter Card
    expect(html).toMatch(/<meta[^>]+name="twitter:card"[^>]+content="summary_large_image"/);
    expect(html).toMatch(/<meta[^>]+name="twitter:image"[^>]+content="https?:\/\//);

    // JSON-LD (cada @type esperado tem um <script>)
    const ldBlocks = Array.from(
      html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
    ).map((m) => m[1]);
    expect(ldBlocks.length).toBeGreaterThan(0);

    for (const expectedType of fx.expectations.jsonLdTypes) {
      const found = ldBlocks.some((raw) => {
        try {
          const parsed = JSON.parse(raw);
          return parsed?.['@type'] === expectedType && parsed?.['@context'] === 'https://schema.org';
        } catch {
          return false;
        }
      });
      expect(found, `JSON-LD ${expectedType} ausente no HTML inicial de ${fx.path}`).toBe(true);
    }
  });

  it('HTML inicial nunca emite metas duplicadas (canonical/description únicos)', () => {
    renderHook(() =>
      useSeoHead({
        title: 'Teste duplicidade',
        description:
          'Garantindo que cada meta crítica aparece apenas uma vez no HTML inicial.',
        canonical: 'https://precisodeum.com.br/categoria/duplicacao',
      }),
    );
    const html = serializeHead();
    const canonicalCount = (html.match(/rel="canonical"/g) || []).length;
    const descCount = (html.match(/name="description"/g) || []).length;
    const robotsCount = (html.match(/name="robots"/g) || []).length;
    expect(canonicalCount).toBe(1);
    expect(descCount).toBe(1);
    expect(robotsCount).toBe(1);
  });
});
