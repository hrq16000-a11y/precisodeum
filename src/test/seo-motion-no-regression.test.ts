/**
 * Garante que o motion system não prejudica SSR/SEO nem Core Web Vitals
 * nas páginas de catálogo e SEO local.
 *
 * Regras travadas:
 *  - Nenhuma animação esconde conteúdo do crawler (sem display:none/visibility)
 *  - Deslocamento de entrada ≤ 8px e sem animar propriedades que causam CLS
 *    (width/height/top/left/margin) → só opacity/transform
 *  - Páginas SEO continuam emitindo title/canonical/JSON-LD
 *  - Skeletons reservam espaço (min-h/aspect) para não gerar layout shift
 *  - prefers-reduced-motion neutraliza tudo
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
const css = read('src/index.css');

const SEO_PAGES = [
  'src/pages/CategoryPage.tsx',
  'src/pages/CityPage.tsx',
  'src/pages/ProviderProfile.tsx',
];

describe('Motion × SEO/SSR', () => {
  it('classes de motion não escondem conteúdo do crawler', () => {
    const block = css.slice(css.indexOf('@keyframes motionEnterUp'));
    expect(block).not.toMatch(/\.motion-enter[^{]*\{[^}]*display:\s*none/);
    expect(block).not.toMatch(/\.motion-enter[^{]*\{[^}]*visibility:\s*hidden/);
    // `both` garante estado final visível mesmo se a animação não rodar (SSR/print).
    expect(block).toContain('var(--motion-ease-out) both');
  });

  it('animações de entrada só usam opacity/transform (sem CLS)', () => {
    const keyframes = css.match(/@keyframes motionEnter\w+\s*\{[^}]*\}[^}]*\}/g) || [];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const k of keyframes) {
      expect(k, `keyframe anima propriedade de layout: ${k}`).not.toMatch(
        /(^|[\s;{])(width|height|top|left|right|bottom|margin|padding)\s*:/,
      );
    }
  });

  it('deslocamento vertical de entrada é ≤ 8px', () => {
    const shifts = [...css.matchAll(/translate3d\(0,\s*(\d+)px,\s*0\)/g)].map((m) => Number(m[1]));
    expect(shifts.length).toBeGreaterThan(0);
    for (const px of shifts) expect(px).toBeLessThanOrEqual(8);
  });

  it('prefers-reduced-motion neutraliza animações e mantém conteúdo visível', () => {
    const block = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('animation: none !important');
    expect(block).toContain('opacity: 1 !important');
    expect(block).toContain('transform: none !important');
  });

  it('páginas SEO mantêm metadados (title/canonical/JSON-LD) independentes do motion', () => {
    for (const file of SEO_PAGES) {
      const src = read(file);
      expect(/Helmet|useSeoHead|SeoMeta/.test(src), `${file}: sem head SEO`).toBe(true);
      expect(/canonical/i.test(src), `${file}: sem canonical`).toBe(true);
      expect(/useJsonLd|application\/ld\+json/.test(src), `${file}: sem JSON-LD`).toBe(true);
    }
  });

  it('nenhuma página SEO usa opacity-0 permanente sem animação (risco de conteúdo invisível)', () => {
    for (const file of SEO_PAGES) {
      const src = read(file);
      const suspicious = /className="[^"]*\bopacity-0\b[^"]*"/g;
      for (const m of src.match(suspicious) || []) {
        expect(
          /group-hover|hover:|focus|animate|motion|transition|data-\[/.test(m),
          `${file}: opacity-0 sem gatilho → ${m}`,
        ).toBe(true);
      }
    }
  });

  it('LazyImage reserva espaço (aspect ratio) para evitar CLS', () => {
    const src = read('src/components/motion/LazyImage.tsx');
    expect(src).toContain('aspect');
    expect(src).toContain('loading');
  });

  it('imagens lazy nunca ficam invisíveis para o crawler (fallback data-loaded)', () => {
    expect(css).toContain(".motion-img[data-loaded='true']");
    const block = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('.motion-img');
  });

  it('skeletons das páginas SEO reservam altura (sem colapso de layout)', () => {
    for (const file of SEO_PAGES) {
      const src = read(file);
      if (!src.includes('Skeleton')) continue;
      expect(/h-\d|min-h|aspect-/.test(src), `${file}: skeleton sem altura reservada`).toBe(true);
    }
  });
});
