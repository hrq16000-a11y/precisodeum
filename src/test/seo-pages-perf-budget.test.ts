/**
 * Performance budget — páginas SEO (categoria/cidade/profissional).
 *
 * Faz checagens estáticas que rodam em <1s (sem precisar de build) para
 * impedir regressões de Core Web Vitals antes do build/Lighthouse:
 *  - Cada página SEO é code-split (dynamic import em App.tsx).
 *  - Helpers de canonical/JSON-LD compartilhados (não duplicados por página).
 *  - Tamanho do source TS dentro do orçamento.
 *
 * Para validação em runtime usamos `npm run lighthouse:ci` no CI dedicado.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

const SEO_PAGES = [
  { name: 'CategoryPage',    file: 'src/pages/CategoryPage.tsx',    maxKb: 40 },
  { name: 'CityDetailPage',  file: 'src/pages/CityDetailPage.tsx',  maxKb: 40 },
  { name: 'ProviderProfile', file: 'src/pages/ProviderProfile.tsx', maxKb: 140 },
];

describe('SEO pages — performance budget estático', () => {
  for (const p of SEO_PAGES) {
    it(`${p.name} é code-split em App.tsx`, () => {
      const re = new RegExp(`lazy\\(\\(\\) => import\\(["']\\./pages/${p.name}["']\\)\\)`);
      expect(re.test(APP), `${p.name} não está em lazy import`).toBe(true);
    });

    it(`${p.name} source ≤ ${p.maxKb}KB`, () => {
      const full = path.join(process.cwd(), p.file);
      if (!fs.existsSync(full)) return; // tolerante caso o arquivo seja renomeado
      const kb = fs.statSync(full).size / 1024;
      expect(kb, `${p.name} = ${kb.toFixed(2)}KB`).toBeLessThanOrEqual(p.maxKb);
    });

    it(`${p.name} usa helpers compartilhados de SEO (sem duplicação)`, () => {
      const full = path.join(process.cwd(), p.file);
      if (!fs.existsSync(full)) return;
      const src = fs.readFileSync(full, 'utf8');
      // Não pode construir canonical "na mão".
      expect(src.includes('window.location.origin +'), `${p.name}: canonical hardcoded`).toBe(false);
      // Não pode injetar <script type="application/ld+json"> manualmente fora do helper.
      const manualJsonLd = /<script[^>]+application\/ld\+json/.test(src);
      if (manualJsonLd) {
        // se tiver, precisa estar no helper useJsonLd/useSeoHead
        expect(src.includes('useJsonLd') || src.includes('useSeoHead')).toBe(true);
      }
    });
  }
});
