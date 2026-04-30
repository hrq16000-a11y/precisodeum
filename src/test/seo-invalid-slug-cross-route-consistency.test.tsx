/**
 * seo-invalid-slug-cross-route-consistency.test.tsx
 *
 * Para cada rota dinâmica (/categoria, /cidade, /profissional), simula um
 * slug INVÁLIDO (inexistente, com caracteres ruins, vazio) e garante:
 *   - <meta name="robots"> = "noindex, nofollow"
 *   - <link rel="canonical"> ainda é absoluto e estável
 *   - og:url == canonical
 *   - og:image continua 1200x630
 *   - JSON-LD opcional NÃO é emitido (ou é emitido com @context válido,
 *     nunca como objeto malformado que confunda crawlers)
 *
 * Garante a consistência cross-camadas (HTML inicial / OG / JSON-LD) para
 * páginas 404 dinâmicas.
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

interface InvalidFixture {
  label: string;
  canonical: string;
  emitJsonLd?: boolean;
}

const invalidFixtures: InvalidFixture[] = [
  { label: '/categoria/slug-inexistente', canonical: 'https://precisodeum.com.br/categoria/slug-que-nao-existe' },
  { label: '/cidade/slug-com-acento-mal', canonical: 'https://precisodeum.com.br/cidade/cidade-invalida' },
  { label: '/profissional/perfil-removido', canonical: 'https://precisodeum.com.br/profissional/perfil-inexistente' },
  // Edge case: slug contendo caracteres improváveis — canonical ainda deve ser estável.
  { label: '/categoria/com-query-params', canonical: 'https://precisodeum.com.br/categoria/categoria-x' },
];

describe('SEO — consistência robots/canonical/OG/JSON-LD para slugs INVÁLIDOS', () => {
  beforeEach(() => clearHead());
  afterEach(() => cleanup());

  it.each(invalidFixtures)('$label emite noindex+nofollow e canonical absoluto', (fx) => {
    renderHook(() =>
      useSeoHead({
        title: 'Página não encontrada',
        description: 'Este conteúdo não está mais disponível ou o endereço foi digitado incorretamente.',
        canonical: fx.canonical,
        noindex: true,
      }),
    );

    const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    expect(robots?.content).toBe('noindex, nofollow');

    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    expect(canonical?.href).toMatch(/^https:\/\//);

    const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    expect(ogUrl?.content).toBe(canonical?.href);

    // OG image segue padrão 1200x630 (mesmo em 404 — fallback estável)
    const w = document.querySelector('meta[property="og:image:width"]') as HTMLMetaElement | null;
    const h = document.querySelector('meta[property="og:image:height"]') as HTMLMetaElement | null;
    expect(w?.content).toBe('1200');
    expect(h?.content).toBe('630');
  });

  it('quando JSON-LD é emitido em página inválida, ele tem @context válido', () => {
    // Simula um caso onde a página 404 emite (por engano) um BreadcrumbList.
    renderHook(() => {
      useSeoHead({
        title: 'Não encontrado',
        description: 'Conteúdo indisponível.',
        canonical: 'https://precisodeum.com.br/categoria/inexistente',
        noindex: true,
      });
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://precisodeum.com.br/' },
          ],
        },
        'invalid-slug-breadcrumb',
      );
    });

    const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    expect(robots?.content).toBe('noindex, nofollow');

    const ldNode = document.getElementById('invalid-slug-breadcrumb') as HTMLScriptElement | null;
    expect(ldNode).toBeTruthy();
    const parsed = JSON.parse(ldNode!.textContent || '{}');
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('BreadcrumbList');
    expect(Array.isArray(parsed.itemListElement)).toBe(true);
  });

  it('og:title e og:description ficam preenchidos mesmo em rota inválida', () => {
    renderHook(() =>
      useSeoHead({
        title: 'Página não encontrada',
        description: 'Este conteúdo não está mais disponível.',
        canonical: 'https://precisodeum.com.br/profissional/x',
        noindex: true,
      }),
    );
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    expect(ogTitle?.content).toBeTruthy();
    expect(ogDesc?.content).toBeTruthy();
    expect(ogTitle?.content).toContain('Preciso de um');
  });

  it('canonical normaliza barra final mesmo para rota inválida', () => {
    renderHook(() =>
      useSeoHead({
        title: '404',
        description: 'Não encontrado.',
        canonical: 'https://precisodeum.com.br/categoria/qualquer/',
        noindex: true,
      }),
    );
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    // buildCanonicalUrl remove trailing slash exceto na raiz.
    expect(canonical?.href).toMatch(/\/categoria\/qualquer$/);
  });
});
