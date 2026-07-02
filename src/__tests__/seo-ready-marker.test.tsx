/**
 * Garante que as 3 páginas SEO-críticas renderizam o atributo
 * `data-seo-ready="true"` SOMENTE depois que os dados reais carregaram.
 * Esse marcador é o gate que o Playwright (scripts/prerender.mjs) usa para
 * capturar o snapshot — sem ele o título genérico do shell vaza para o HTML.
 *
 * Teste estático: lê os arquivos-fonte e verifica:
 *   1. O atributo existe na raiz do JSX.
 *   2. A expressão depende de `!isLoading`/`!loading` E da presença do dado real
 *      (`category`, `city` ou `provider`).
 *   3. Quando a condição falha, o atributo é `undefined` (não-presente no DOM),
 *      não `false` ou string vazia — o `waitForFunction` do prerender depende
 *      do seletor `[data-seo-ready="true"]`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Spec {
  file: string;
  loadingFlag: RegExp;
  dataFlag: RegExp;
}

const SPECS: Spec[] = [
  {
    file: 'src/pages/CategoryPage.tsx',
    loadingFlag: /!isLoading/,
    dataFlag: /!!category/,
  },
  {
    file: 'src/pages/CityPage.tsx',
    loadingFlag: /!isLoading/,
    dataFlag: /!!city/,
  },
  {
    file: 'src/pages/ProviderProfile.tsx',
    loadingFlag: /!loading/,
    dataFlag: /!!provider/,
  },
];

describe('SEO ready marker (data-seo-ready) — prerender gate', () => {
  for (const spec of SPECS) {
    it(`${spec.file} marca data-seo-ready apenas após hidratação`, () => {
      const src = readFileSync(resolve(process.cwd(), spec.file), 'utf-8');
      const match = src.match(/data-seo-ready=\{([^}]+)\}/);
      expect(match, `data-seo-ready ausente em ${spec.file}`).toBeTruthy();
      const expr = match![1];
      expect(expr).toMatch(spec.loadingFlag);
      expect(expr).toMatch(spec.dataFlag);
      // Quando a condição falha, deve resolver para `undefined` (atributo
      // removido do DOM), não para `false`/`'false'`/string vazia.
      expect(expr).toMatch(/:\s*undefined/);
      expect(expr).toMatch(/['"]true['"]/);
    });
  }

  it('prerender.mjs usa o seletor [data-seo-ready="true"] como gate', () => {
    const src = readFileSync(resolve(process.cwd(), 'scripts/prerender.mjs'), 'utf-8');
    expect(src).toMatch(/data-seo-ready="true"/);
  });
});
