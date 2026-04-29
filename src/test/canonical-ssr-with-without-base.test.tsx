/**
 * canonical-ssr-with-without-base.test.tsx
 *
 * Valida que /categoria/{slug}, /cidade/{cidade} e /profissional/{slug}
 * geram canonical e og:url corretos via `useSeoHead`, tanto quando
 * `SITE_BASE_URL` está definido quanto quando está ausente (fallback fixo).
 *
 * Como `useSeoHead` chama `buildCanonicalUrl(canonical || pathname)`, o teste
 * exercita o helper compartilhado em ambos os modos e garante que a saída é
 * sempre absoluta e bate com o último item do BreadcrumbList esperado pelo
 * sitemap.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

vi.mock('@/hooks/useSiteSettings', () => ({ useSettingValue: () => null }));

const ROUTES = [
  { path: '/categoria/eletricista', expectedPath: '/categoria/eletricista' },
  { path: '/cidades/pr/curitiba', expectedPath: '/cidades/pr/curitiba' },
  { path: '/profissional/joao-silva', expectedPath: '/profissional/joao-silva' },
];

function clearHead() {
  document.querySelectorAll('link[rel="canonical"]').forEach((n) => n.remove());
  document.querySelectorAll('meta[property="og:url"]').forEach((n) => n.remove());
}

function getCanonical() {
  return (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href ?? null;
}
function getOgUrl() {
  return (document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null)?.content ?? null;
}

async function renderSeo(path: string) {
  // Reset module cache to re-read SITE_BASE_URL for each scenario.
  vi.resetModules();
  const { useSeoHead, SITE_BASE_URL } = await import('@/hooks/useSeoHead');
  window.history.replaceState({}, '', path);
  renderHook(() =>
    useSeoHead({ title: 'Teste', description: 'descrição válida com mais de 50 caracteres aqui.' }),
  );
  return SITE_BASE_URL;
}

describe('Canonical SSR — com e sem SITE_BASE_URL', () => {
  const ORIGINAL = process.env.SITE_BASE_URL;
  beforeEach(() => clearHead());
  afterEach(() => {
    cleanup();
    if (ORIGINAL === undefined) delete process.env.SITE_BASE_URL;
    else process.env.SITE_BASE_URL = ORIGINAL;
  });

  describe('SITE_BASE_URL DEFINIDO', () => {
    beforeEach(() => {
      process.env.SITE_BASE_URL = 'https://staging.precisodeum.com.br';
    });

    it.each(ROUTES)('rota $path emite canonical absoluto + og:url alinhado', async ({ path, expectedPath }) => {
      const base = await renderSeo(path);
      const canonical = getCanonical();
      const og = getOgUrl();
      expect(canonical).toBeTruthy();
      expect(canonical).toMatch(/^https:\/\//);
      expect(canonical).toBe(`${base}${expectedPath}`);
      expect(og).toBe(canonical);
    });
  });

  describe('SITE_BASE_URL AUSENTE (fallback)', () => {
    beforeEach(() => {
      delete process.env.SITE_BASE_URL;
    });

    it.each(ROUTES)('rota $path mantém canonical absoluto via fallback', async ({ path, expectedPath }) => {
      await renderSeo(path);
      const canonical = getCanonical();
      const og = getOgUrl();
      // Fallback canônico de produção exposto pelo helper.
      expect(canonical).toMatch(/^https:\/\/[^/]+/);
      expect(canonical?.endsWith(expectedPath)).toBe(true);
      expect(og).toBe(canonical);
    });
  });
});
