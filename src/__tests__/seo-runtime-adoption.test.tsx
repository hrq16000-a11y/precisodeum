/**
 * Fase 2.9 — Runtime adoption guardrail.
 *
 * Não renderiza as páginas inteiras (custo alto e quebra de mocks). Em vez
 * disso, valida que as 5 páginas SEO críticas montam o SeoEnhancementSection
 * lazy via importWithRetry — ou seja, o helper está conectado e fora do
 * critical path.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PAGES = [
  'src/pages/CategoryPage.tsx',
  'src/pages/CityPage.tsx',
  'src/pages/CategoryCityPage.tsx',
  'src/pages/ProviderProfile.tsx',
  'src/pages/CompanyProfile.tsx',
];

describe('Fase 2.9 · adoção runtime SEO', () => {
  for (const p of PAGES) {
    const src = fs.readFileSync(path.join(process.cwd(), p), 'utf8');

    it(`${p} importa SeoEnhancementSection via lazy + importWithRetry`, () => {
      expect(src.includes("'@/components/seo/SeoEnhancementSection'")).toBe(true);
      expect(/lazy\(\s*\(\)\s*=>\s*importWithRetry/.test(src)).toBe(true);
    });

    it(`${p} monta <SeoEnhancementSection> dentro de <Suspense>`, () => {
      expect(src.includes('<SeoEnhancementSection')).toBe(true);
      expect(src.includes('<Suspense')).toBe(true);
    });

    it(`${p} passa indexation com path canônico`, () => {
      expect(/indexation=\{\{[\s\S]{0,400}path:/.test(src)).toBe(true);
    });
  }

  it('SeoEnhancementSection é fail-closed (retorna null em noindex)', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/components/seo/SeoEnhancementSection.tsx'),
      'utf8',
    );
    expect(src.includes('if (!verdict.index) return null;')).toBe(true);
  });
});
