/**
 * Garante que a cadeia de redirects do sitemap preserva o caminho esperado
 * (sem mudanças imprevisíveis) e que NÃO existem loops entre rotas
 * equivalentes — ex.: /cidade ↔ /cidades, /categoria-list ↔ /categorias.
 */
import { describe, it, expect } from 'vitest';
import {
  ROUTE_ALIASES,
  resolveRedirectChain,
  detectAliasLoops,
} from '@/lib/routeAliases';

describe('sitemap redirect chain', () => {
  it('resolve alias para canônico em 1 salto, preservando o restante do path', () => {
    const redirects = [
      { from: '/cidade', to: '/cidades' },
      { from: '/cidade/sao-paulo', to: '/cidades/sp/sao-paulo' },
    ];
    const r = resolveRedirectChain('/cidade/sao-paulo', redirects);
    expect(r.finalPath).toBe('/cidades/sp/sao-paulo');
    expect(r.loop).toBe(false);
    expect(r.hops.length).toBeLessThanOrEqual(2);
  });

  it('detecta loop entre páginas equivalentes (/cidade ↔ /cidades)', () => {
    const redirects = [
      { from: '/cidade', to: '/cidades' },
      { from: '/cidades', to: '/cidade' },
    ];
    const r = resolveRedirectChain('/cidade', redirects);
    expect(r.loop).toBe(true);
  });

  it('falha se o sitemap emite alias conhecido como URL final', () => {
    const issues = detectAliasLoops(
      ['https://precisodeum.com.br/cidade/curitiba'],
      [],
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/alias/);
  });

  it('aceita URL canônica sem reportar problema', () => {
    const issues = detectAliasLoops(
      [
        'https://precisodeum.com.br/cidades/pr/curitiba',
        'https://precisodeum.com.br/categoria/eletricista',
        'https://precisodeum.com.br/profissional/joao-silva',
      ],
      [],
    );
    expect(issues).toEqual([]);
  });

  it('catálogo de aliases cobre as rotas SEO principais', () => {
    const canonicals = ROUTE_ALIASES.map((r) => r.canonical);
    expect(canonicals).toContain('/cidades');
    expect(canonicals).toContain('/categorias');
    expect(canonicals).toContain('/profissionais');
  });
});
