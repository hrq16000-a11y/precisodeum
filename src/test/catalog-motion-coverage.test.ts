import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

const ROUTES = [
  { route: '/buscar', file: 'src/pages/SearchPage.tsx', testId: 'search-loading' },
  { route: '/categoria/:slug', file: 'src/pages/CategoryPage.tsx', testId: 'category-loading' },
  { route: '/cidade/:slug', file: 'src/pages/CityPage.tsx', testId: 'city-loading' },
];

describe('Catálogo · cobertura de motion e loading', () => {
  for (const { route, file, testId } of ROUTES) {
    const src = read(file);

    it(`${route} renderiza skeleton identificável durante o carregamento`, () => {
      expect(src).toContain('isLoading');
      expect(src).toContain(`data-testid="${testId}"`);
      expect(/Skeleton/.test(src)).toBe(true);
    });

    it(`${route} exibe ProgressIndicator de carregamento/atualização`, () => {
      expect(src).toContain('ProgressIndicator');
    });

    it(`${route} trata erro e vazio sem tela em branco`, () => {
      expect(src).toContain('isError');
      expect(/EmptyState|Nenhum profissional|SearchEmptyState/.test(src)).toBe(true);
    });

    it(`${route} usa animação de entrada do design system`, () => {
      expect(/motion-enter|motion-stagger/.test(src)).toBe(true);
    });
  }

  it('não usa animações fora do sistema (durations arbitrárias longas)', () => {
    for (const { file } of ROUTES) {
      expect(read(file)).not.toMatch(/duration-\[?[5-9]\d{2,}ms?\]?/);
    }
  });
});

describe('Acessibilidade · prefers-reduced-motion', () => {
  const css = read('src/index.css');

  it('neutraliza as animações do sistema quando o usuário pede menos movimento', () => {
    const block = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('animation: none !important');
    for (const cls of ['.motion-enter', '.motion-stagger', '.skeleton-shimmer']) {
      expect(block, `${cls} não neutralizado`).toContain(cls);
    }
  });

  it('mantém as classes de motion declaradas globalmente', () => {
    for (const cls of ['.motion-enter', '.motion-enter-fade', '.motion-stagger', '.motion-indeterminate']) {
      expect(css).toContain(cls);
    }
  });
});
