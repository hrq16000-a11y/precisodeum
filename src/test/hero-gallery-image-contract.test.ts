import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Contrato de imagens do Hero e da Gallery.
 *
 * Trava, por análise estática do código-fonte, os itens que reduzem jank/CLS:
 *  - Hero: <picture> com AVIF → WebP → fallback, srcSet 640/1280/1920 e sizes="100vw";
 *  - Gallery: srcSet responsivo, sizes por breakpoint, blur-up (placeholder minúsculo),
 *    loading="lazy" e decoding="async";
 *  - LazyImage: reserva de espaço (aspect-ratio) + shimmer + cross-fade do blur.
 */

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

const HERO = 'src/components/home/HeroBanner.tsx';
const PROFILE = 'src/pages/ProviderProfile.tsx';
const LAZY = 'src/components/motion/LazyImage.tsx';

describe('Hero · contrato de imagem responsiva', () => {
  const src = read(HERO);

  it('usa <picture> negociando AVIF antes de WebP', () => {
    expect(src).toMatch(/<picture/);
    const avif = src.indexOf('type="image/avif"');
    const webp = src.indexOf('type="image/webp"');
    expect(avif).toBeGreaterThan(-1);
    expect(webp).toBeGreaterThan(-1);
    expect(avif).toBeLessThan(webp);
  });

  it('gera srcSet nos três breakpoints (640/1280/1920)', () => {
    const helper = src.match(/const heroSrcSet[\s\S]{0,400}?\n};/)?.[0] ?? '';
    for (const width of [640, 1280, 1920]) {
      expect(helper).toContain(String(width));
    }
  });

  it('declara sizes="100vw" em todas as fontes do hero', () => {
    const sources = src.match(/<source[^>]*>/g) ?? [];
    expect(sources.length).toBeGreaterThanOrEqual(2);
    for (const tag of sources) {
      expect(tag).toContain('srcSet=');
      expect(tag).toContain('sizes="100vw"');
    }
  });

  it('marca a imagem LCP como prioritária (sem lazy na primeira dobra)', () => {
    expect(src).toMatch(/fetchpriority|fetchPriority/i);
  });
});

describe('Gallery · contrato de imagem responsiva', () => {
  const src = read(PROFILE);
  const galleryImgs = (src.match(/<img[^>]*responsiveImageSrcSet[^>]*>/g) ?? []);

  it('todas as imagens da galeria têm srcSet responsivo', () => {
    expect(galleryImgs.length).toBeGreaterThan(0);
    for (const tag of galleryImgs) {
      expect(tag).toContain('responsiveImageSrcSet');
      expect(tag).toMatch(/\[300, 600, 900\]/);
    }
  });

  it('define sizes por breakpoint (mobile x desktop)', () => {
    for (const tag of galleryImgs) {
      expect(tag).toContain('sizes="(max-width: 640px) 45vw, 300px"');
    }
  });

  it('aplica blur-up com placeholder minúsculo antes da imagem final', () => {
    for (const tag of galleryImgs) {
      expect(tag).toContain('backgroundImage');
      expect(tag).toMatch(/width: 24/);
    }
  });

  it('carrega em lazy e decodifica de forma assíncrona', () => {
    for (const tag of galleryImgs) {
      expect(tag).toContain('loading="lazy"');
      expect(tag).toContain('decoding="async"');
    }
  });

  it('capa do perfil também usa srcSet multi-largura com sizes', () => {
    expect(src).toMatch(/480w[\s\S]{0,400}1600w/);
    expect(src).toContain('sizes="(max-width: 640px) 100vw, (max-width: 1280px) 100vw, 1600px"');
  });
});

describe('LazyImage · reserva de espaço e cross-fade', () => {
  const src = read(LAZY);

  it('reserva o espaço via aspect-ratio (sem CLS)', () => {
    expect(src).toContain('aspectRatio');
  });

  it('mostra shimmer enquanto não há blur nem imagem', () => {
    expect(src).toContain('skeleton-shimmer');
  });

  it('faz cross-fade do blur para a imagem final', () => {
    expect(src).toMatch(/opacity-0[\s\S]{0,40}opacity-100/);
  });

  it('respeita priority para a imagem LCP', () => {
    expect(src).toMatch(/priority \? 'eager' : 'lazy'/);
  });
});
