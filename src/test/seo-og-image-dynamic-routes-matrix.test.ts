/**
 * seo-og-image-dynamic-routes-matrix.test.ts
 *
 * Garante que as 3 rotas dinâmicas (categoria, cidade, profissional) emitem
 * og:image / twitter:image com as dimensões obrigatórias (1200x630) e que a
 * URL aponta para um asset HTTPS absoluto. Exercitamos `useSeoHead` UMA vez
 * por rota e inspecionamos o <head> serializado — o mesmo formato visto por
 * crawlers (Twitterbot, Slackbot, Googlebot).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useSeoHead } from '@/hooks/useSeoHead';

vi.mock('@/hooks/useSiteSettings', () => ({ useSettingValue: () => null }));

function clearHead() {
  document
    .querySelectorAll('link[rel="canonical"], meta[name], meta[property]')
    .forEach((n) => n.remove());
  document.title = '';
}

interface Fixture {
  label: string;
  title: string;
  description: string;
  canonical: string;
  ogType?: 'website' | 'article' | 'profile';
}

const fixtures: Fixture[] = [
  {
    label: '/categoria/:slug',
    title: 'Eletricista no Brasil — Profissionais Verificados',
    description: 'Encontre eletricistas verificados em todo o Brasil com avaliações reais e contato direto.',
    canonical: 'https://precisodeum.com.br/categoria/eletricista',
  },
  {
    label: '/cidade/:slug',
    title: 'Profissionais em São Paulo',
    description: 'Encontre profissionais verificados em São Paulo com avaliações e contato direto pelo WhatsApp.',
    canonical: 'https://precisodeum.com.br/cidade/sao-paulo',
  },
  {
    label: '/profissional/:slug',
    title: 'João Silva — Eletricista em São Paulo',
    description: 'João Silva é eletricista verificado em São Paulo com avaliações reais e contato direto.',
    canonical: 'https://precisodeum.com.br/profissional/joao-silva-sp',
    ogType: 'profile',
  },
];

describe('SEO og:image — matriz por rota dinâmica (categoria/cidade/profissional)', () => {
  beforeEach(() => clearHead());
  afterEach(() => cleanup());

  it.each(fixtures)('$label declara og:image 1200x630 com URL absoluta HTTPS', (fx) => {
    renderHook(() =>
      useSeoHead({
        title: fx.title,
        description: fx.description,
        canonical: fx.canonical,
        ogType: fx.ogType,
      }),
    );

    const w = document.querySelector('meta[property="og:image:width"]') as HTMLMetaElement | null;
    const h = document.querySelector('meta[property="og:image:height"]') as HTMLMetaElement | null;
    const og = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
    const ogSecure = document.querySelector('meta[property="og:image:secure_url"]') as HTMLMetaElement | null;
    const ogType = document.querySelector('meta[property="og:image:type"]') as HTMLMetaElement | null;
    const ogAlt = document.querySelector('meta[property="og:image:alt"]') as HTMLMetaElement | null;
    const tw = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null;
    const twAlt = document.querySelector('meta[name="twitter:image:alt"]') as HTMLMetaElement | null;
    const card = document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement | null;

    expect(w?.content).toBe('1200');
    expect(h?.content).toBe('630');
    expect(og?.content).toMatch(/^https:\/\//);
    expect(ogSecure?.content).toMatch(/^https:\/\//);
    expect(ogSecure?.content).toBe(og?.content);
    expect(ogType?.content).toMatch(/^image\/(png|jpeg)$/);
    expect(ogAlt?.content || '').toContain('Preciso de um');
    expect(tw?.content).toMatch(/^https:\/\//);
    expect(twAlt?.content || '').toContain('Preciso de um');
    expect(card?.content).toBe('summary_large_image');
  });

  it('og:image, og:image:secure_url e twitter:image apontam para a MESMA URL', () => {
    for (const fx of fixtures) {
      clearHead();
      renderHook(() =>
        useSeoHead({
          title: fx.title,
          description: fx.description,
          canonical: fx.canonical,
          ogType: fx.ogType,
        }),
      );
      const og = (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content;
      const ogSec = (document.querySelector('meta[property="og:image:secure_url"]') as HTMLMetaElement)?.content;
      const tw = (document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement)?.content;
      expect(og, `og:image vazio em ${fx.label}`).toBeTruthy();
      expect(og).toBe(ogSec);
      expect(og).toBe(tw);
      cleanup();
    }
  });

  it('nenhuma rota dinâmica emite og:image:width/height fora de 1200x630', () => {
    for (const fx of fixtures) {
      clearHead();
      renderHook(() =>
        useSeoHead({
          title: fx.title,
          description: fx.description,
          canonical: fx.canonical,
          ogType: fx.ogType,
        }),
      );
      const widths = document.querySelectorAll('meta[property="og:image:width"]');
      const heights = document.querySelectorAll('meta[property="og:image:height"]');
      // Exatamente uma tag de width e uma de height por página.
      expect(widths.length).toBe(1);
      expect(heights.length).toBe(1);
      expect((widths[0] as HTMLMetaElement).content).toBe('1200');
      expect((heights[0] as HTMLMetaElement).content).toBe('630');
      cleanup();
    }
  });
});
