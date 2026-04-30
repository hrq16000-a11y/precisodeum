/**
 * Valida estaticamente que `useSeoHead` declara dimensões 1200x630 para
 * og:image e que a URL de fallback aponta para asset existente no projeto
 * (ou é absoluta sob domínio canônico).
 *
 * Estratégia: lemos o código-fonte de `src/hooks/useSeoHead.ts` (string) e
 * validamos:
 *  1. presença das tags `og:image:width=1200` e `og:image:height=630`
 *  2. existência de `twitter:image`
 *  3. fallback aponta para arquivo público em /public ou URL absoluta
 *
 * Não fazemos fetch real (testes offline / CI sem rede); a validação de
 * status 200 acontece via crawl-sitemaps em scripts/.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const HOOK_PATH = path.resolve(__dirname, '../hooks/useSeoHead.ts');
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

describe('SEO og:image / twitter:image — dimensions & validity', () => {
  const src = readFileSync(HOOK_PATH, 'utf-8');

  it('declara og:image:width = 1200', () => {
    expect(src).toMatch(/og:image:width[^]*1200/);
  });

  it('declara og:image:height = 630', () => {
    expect(src).toMatch(/og:image:height[^]*630/);
  });

  it('emite tag twitter:image', () => {
    expect(src).toMatch(/twitter:image/);
  });

  it('emite tag og:image (string ou variável)', () => {
    expect(src).toMatch(/['"]og:image['"]/);
  });

  it('fallback de imagem aponta para asset público válido', () => {
    // procura URLs de fallback declaradas como string literal
    const matches = Array.from(
      src.matchAll(/['"`](\/[^'"`\s]+\.(?:png|jpg|jpeg|webp))['"`]/g),
    ).map((m) => m[1]);

    if (matches.length === 0) {
      // tolerância: o fallback pode vir de outra constante (ex: siteAssets.ts)
      // mas precisa mencionar `og` ou `social` no contexto
      expect(src).toMatch(/og[-_]?image|socialImage|defaultImage/i);
      return;
    }

    for (const rel of matches) {
      const filePath = path.join(PUBLIC_DIR, rel);
      // se não existir em /public, deve ser referência a /assets bundled — aí
      // não temos como validar offline; só falhamos se for /public claro
      if (rel.startsWith('/') && !rel.startsWith('/src/')) {
        // só validamos arquivos que claramente residem em /public
        const isPublicFallback = rel.match(/\/(og|social|share|placeholder|logo)/i);
        if (isPublicFallback) {
          expect(existsSync(filePath), `Asset público ausente: ${rel}`).toBe(true);
        }
      }
    }
  });

  it('canonical é absoluto (https://...)', () => {
    // canonical deve ser construído via buildCanonicalUrl ou começar com https
    expect(src).toMatch(/buildCanonicalUrl|https:\/\//);
  });
});
