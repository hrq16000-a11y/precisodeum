/**
 * Brand logo UI checks (desktop/mobile)
 *
 * Garante que:
 *  - O componente <Logo /> renderiza um <img> com alt acessível, srcset webp/png
 *    e dimensões intrínsecas — em viewports desktop e mobile.
 *  - Os layouts principais (Header, DashboardLayout, AdminLayout) importam e
 *    renderizam o componente <Logo /> (proteção estática contra remoção
 *    acidental do logo nos cabeçalhos).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from '@/lib/router-compat';
import fs from 'node:fs';
import path from 'node:path';
import Logo from '@/components/Logo';
import {
  DEFAULT_LOGO_URL,
  DEFAULT_LOGO_SRCSET,
  DEFAULT_LOGO_PNG_SRCSET,
  DEFAULT_SOCIAL_IMAGE_URL,
} from '@/lib/siteAssets';

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
};

const renderLogo = (props = {}) =>
  render(
    <MemoryRouter>
      <Logo {...props} />
    </MemoryRouter>
  );

describe('Logo UI · viewports desktop/mobile', () => {
  beforeEach(() => cleanup());

  for (const [label, w, h] of [
    ['desktop', 1440, 900],
    ['tablet', 820, 1180],
    ['mobile', 375, 812],
  ] as const) {
    it(`renderiza logo com alt + srcset webp/png em ${label} (${w}x${h})`, () => {
      setViewport(w, h);
      const { container } = renderLogo({ priority: true });
      const img = container.querySelector('img') as HTMLImageElement | null;
      expect(img, `<img> ausente no viewport ${label}`).toBeTruthy();
      expect(img!.getAttribute('alt')).toBe('Preciso de um Profissional');
      expect(img!.getAttribute('src')).toBe(DEFAULT_LOGO_URL);
      expect(img!.getAttribute('srcset')).toBe(DEFAULT_LOGO_PNG_SRCSET);
      expect(img!.getAttribute('width')).toBeTruthy();
      expect(img!.getAttribute('height')).toBeTruthy();

      const source = container.querySelector('source[type="image/webp"]') as HTMLSourceElement | null;
      expect(source, 'fonte webp ausente').toBeTruthy();
      expect(source!.getAttribute('srcset')).toBe(DEFAULT_LOGO_SRCSET);
    });
  }

  it('aplica filtros de variante white/dark sem perder o <img>', () => {
    setViewport(1440, 900);
    const { container } = renderLogo({ variant: 'white' });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.className).toMatch(/brightness-0/);
    expect(img.className).toMatch(/invert/);
  });
});

describe('Layouts principais usam <Logo />', () => {
  const root = process.cwd();
  const layouts = [
    'src/components/Header.tsx',
    'src/components/DashboardLayout.tsx',
    'src/components/AdminLayout.tsx',
  ];

  for (const rel of layouts) {
    it(`${rel} importa e renderiza <Logo />`, () => {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      expect(src, `${rel} sem import do Logo`).toMatch(
        /import\s+Logo\s+from\s+['"]@\/components\/Logo['"]/
      );
      expect(src, `${rel} sem JSX <Logo`).toMatch(/<Logo[\s/>]/);
    });
  }
});

describe('Assets de marca presentes no bundle', () => {
  const root = process.cwd();
  const required = [
    'public/lovable-uploads/8a22c45f-f2c2-4ac8-a925-92aecd2b313b.png',
    'public/lovable-uploads/logo-brand-380.webp',
    'public/lovable-uploads/logo-brand-710.webp',
    'public/lovable-uploads/logo-brand-380.png',
    'public/lovable-uploads/logo-brand-710.png',
    `public${DEFAULT_SOCIAL_IMAGE_URL}`,
    'public/og-image.png',
  ];

  for (const rel of required) {
    it(`existe no filesystem: ${rel}`, () => {
      const abs = path.join(root, rel);
      expect(fs.existsSync(abs), `asset faltando: ${rel}`).toBe(true);
      const stat = fs.statSync(abs);
      expect(stat.size, `asset vazio: ${rel}`).toBeGreaterThan(100);
    });
  }
});
