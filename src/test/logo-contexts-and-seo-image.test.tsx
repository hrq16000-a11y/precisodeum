/**
 * Logo por contexto + preload + fallback de og:image.
 *
 * Trava:
 *  - todos os contextos usam o MESMO aspect-ratio;
 *  - preload é injetado apenas quando pedido (Header) e sem duplicar;
 *  - `decoding="async"` + espaço reservado (sem CLS);
 *  - resolveSocialImage tenta a lista de candidatos antes do /social-image.png.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import Logo, { LOGO_ASPECT_CLASS, LOGO_SIZE_CLASSES, __resetLogoPreloadForTests } from '@/components/Logo';
import { resolveSocialImage, toSocialImageCandidates } from '@/lib/socialImageFallback';

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

const renderLogo = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <Logo {...props} />
    </MemoryRouter>,
  );

describe('Logo · contextos', () => {
  beforeEach(() => {
    cleanup();
    __resetLogoPreloadForTests();
    document.head.querySelectorAll('link[data-logo-preload]').forEach((el) => el.remove());
  });

  it.each(['header', 'footer', 'dashboard', 'admin'] as const)('mantém aspect-ratio em %s', (context) => {
    const { container } = renderLogo({ context, priority: true });
    const wrapper = container.querySelector('[data-logo-state]') as HTMLElement;
    expect(wrapper.getAttribute('data-logo-context')).toBe(context);
    expect(wrapper.className).toContain(LOGO_ASPECT_CLASS);
    expect(wrapper.className).toContain(LOGO_SIZE_CLASSES[context].split(' ')[0]);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('width')).toBe('710');
    expect(img.getAttribute('height')).toBe('209');
  });

  it('injeta preload uma única vez e só quando solicitado', () => {
    renderLogo({ context: 'footer' });
    expect(document.head.querySelectorAll('link[data-logo-preload]').length).toBe(0);
    renderLogo({ context: 'header', preload: true, priority: true });
    renderLogo({ context: 'header', preload: true, priority: true });
    const links = document.head.querySelectorAll('link[data-logo-preload]');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('rel')).toBe('preload');
    expect(links[0].getAttribute('as')).toBe('image');
    expect(links[0].getAttribute('fetchpriority')).toBe('high');
  });
});

describe('Layouts usam o componente Logo compartilhado', () => {
  it.each([
    ['src/components/Header.tsx', 'header'],
    ['src/components/Footer.tsx', 'footer'],
    ['src/components/DashboardLayout.tsx', 'dashboard'],
    ['src/components/AdminLayout.tsx', 'admin'],
  ])('%s declara context="%s"', (file, context) => {
    const src = read(file);
    expect(src).toContain("from '@/components/Logo'");
    expect(src).toContain(`context="${context}"`);
    // nenhum layout redefine altura da logo por fora (evita conflito de tamanho)
    expect(src).not.toMatch(/<Logo[^>]*className="[^"]*\bh-\d/);
  });

  it('preload existe apenas no Header', () => {
    expect(read('src/components/Header.tsx')).toMatch(/<Logo[\s\S]{0,160}preload/);
    for (const f of ['src/components/Footer.tsx', 'src/components/DashboardLayout.tsx', 'src/components/AdminLayout.tsx']) {
      expect(read(f)).not.toMatch(/<Logo[\s\S]{0,160}\spreload/);
    }
  });
});

describe('og:image · fallback por lista', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normaliza e deduplica candidatos', () => {
    const list = toSocialImageCandidates(['/a.png', '/a.png', '', null as never, '/b.png']);
    expect(list.length).toBe(2);
    expect(list[0]).toMatch(/a\.png$/);
  });

  it('usa a primeira URL válida da lista', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: !String(url).includes('bad'), status: String(url).includes('bad') ? 404 : 200 })));
    const res = await resolveSocialImage(['https://x.test/bad.png', 'https://x.test/good.png']);
    expect(res.url).toBe('https://x.test/good.png');
    expect(res.reason).toBe('ok');
    expect(res.index).toBe(1);
  });

  it('cai em /social-image.png quando todas falham', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
    const res = await resolveSocialImage(['https://x.test/a.png']);
    expect(res.url).toMatch(/social-image\.png$/);
    expect(res.reason).toBe('default');
    expect(res.attempts[0].status).toBe(403);
  });

  it('sem candidatos → default', async () => {
    const res = await resolveSocialImage(undefined);
    expect(res.reason).toBe('empty_candidates');
    expect(res.url).toMatch(/social-image\.png$/);
  });
});

describe('useSeoHead sempre define og:image e twitter:image', () => {
  it('define ambos mesmo sem ogImage informado', () => {
    const src = read('src/hooks/useSeoHead.ts');
    expect(src).toMatch(/setSocialImageMeta\(resolvedOgImage\)/);
    expect(src).toMatch(/setMeta\('twitter:image', content\)/);
    expect(src).toMatch(/DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL/);
    expect(src).toMatch(/ogImage\?: string \| string\[\]/);
  });
});
