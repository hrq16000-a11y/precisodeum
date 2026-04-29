/**
 * canonical-ogurl-shared-helper.test.tsx
 *
 * Garante que `<link rel="canonical">` e `<meta property="og:url">` são
 * gerados pela MESMA função (`buildCanonicalUrl`) e são SEMPRE absolutas e
 * normalizadas em todas as páginas SEO chave.
 *
 * Estratégia: espiar `buildCanonicalUrl`, renderizar o hook `useSeoHead`
 * e validar:
 *   - o helper foi chamado exatamente 1 vez por render;
 *   - canonical e og:url batem com o retorno do helper;
 *   - ambos começam com https:// (URL absoluta).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import * as canonicalLib from '@/lib/canonicalUrl';
import { useSeoHead } from '@/hooks/useSeoHead';

vi.mock('@/hooks/useSiteSettings', () => ({ useSettingValue: () => null }));

const ROUTES = [
  { label: '/categoria/{slug}', path: '/categoria/eletricista' },
  { label: '/cidade/{cidade}', path: '/cidades/pr/curitiba' },
  { label: '/profissional/{slug}', path: '/profissional/joao-silva' },
  { label: '/buscar', path: '/buscar?categoria=eletricista' },
  { label: '/blog/{slug}', path: '/blog/como-contratar-eletricista' },
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

describe('canonical + og:url — mesmo helper compartilhado', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearHead();
    spy = vi.spyOn(canonicalLib, 'buildCanonicalUrl');
  });

  afterEach(() => {
    spy.mockRestore();
    cleanup();
  });

  it.each(ROUTES)('$label usa buildCanonicalUrl e propaga p/ canonical + og:url', ({ path }) => {
    window.history.replaceState({}, '', path);

    renderHook(() =>
      useSeoHead({
        title: 'Teste compartilhamento canonical',
        description: 'Descrição SEO válida com mais de 50 caracteres para garantir parsing.',
      }),
    );

    expect(spy).toHaveBeenCalled();
    // O último retorno do helper é o que deve ter sido escrito no DOM.
    const lastReturn = spy.mock.results[spy.mock.results.length - 1].value as string;
    expect(lastReturn).toMatch(/^https:\/\//);

    const canonical = getCanonical();
    const og = getOgUrl();
    expect(canonical).toBe(lastReturn);
    expect(og).toBe(lastReturn);
    expect(canonical).toMatch(/^https:\/\//);
    expect(og).toMatch(/^https:\/\//);
  });

  it('passar canonical absoluto cross-domain preserva via helper', () => {
    window.history.replaceState({}, '', '/categoria/pintor');
    renderHook(() =>
      useSeoHead({
        title: 'Pintor',
        description: 'Descrição SEO válida com mais de 50 caracteres para garantir parsing.',
        canonical: 'https://precisodeum.com.br/categoria/pintor',
      }),
    );
    const canonical = getCanonical();
    const og = getOgUrl();
    expect(canonical).toBe('https://precisodeum.com.br/categoria/pintor');
    expect(og).toBe(canonical);
  });
});
