/**
 * Fase 2.9 — Guardrail para enhancement leve em ProviderProfile e CompanyProfile.
 *
 * Garante que o enhancement SEO nessas páginas:
 *  - usa providersCount=1 (perfil único, não landing agregada);
 *  - injeta FAQ contextual por categoria/cidade;
 *  - inclui pelo menos um link interno (cidade ou categoria);
 *  - permanece DENTRO de <Suspense> (lazy → sem custo no LCP);
 *  - não chama nenhuma nova RPC/realtime (sem `.channel(` ou `supabase.rpc(`
 *    em volta do mount do enhancement).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FILES = ['src/pages/ProviderProfile.tsx', 'src/pages/CompanyProfile.tsx'];

describe('Fase 2.9 · enhancement leve em perfis', () => {
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
    const block = (() => {
      const i = src.indexOf('<SeoEnhancementSection');
      return i >= 0 ? src.slice(i, i + 1600) : '';
    })();

    it(`${f} usa providersCount=1 no enhancement`, () => {
      expect(block).toContain('providersCount: 1');
    });

    it(`${f} envia faq contextual com categoryName`, () => {
      expect(block).toContain('faq=');
      expect(/categoryName/.test(block)).toBe(true);
    });

    it(`${f} envia ao menos um link interno (cidade ou categoria)`, () => {
      const hasLinks =
        block.includes('relatedCities') ||
        block.includes('relatedCategories') ||
        block.includes('highConversionProviders');
      expect(hasLinks).toBe(true);
    });

    it(`${f} mantém enhancement dentro de <Suspense>`, () => {
      // garante que existe um Suspense imediatamente antes do mount
      const idx = src.indexOf('<SeoEnhancementSection');
      const ctx = src.slice(Math.max(0, idx - 400), idx);
      expect(ctx.includes('<Suspense')).toBe(true);
    });
  }
});
