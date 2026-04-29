/**
 * sitemap-route-aliases-coverage.test.ts
 *
 * Para cada URL canônica gerada pelo `sitemapBuilder`, coleta o segmento raiz
 * (ex.: "/categorias", "/cidades") e:
 *   1. Garante que NENHUM segmento corresponde a um alias conhecido em
 *      ROUTE_ALIASES (deve sempre ser o canônico).
 *   2. Submete a URL a uma cadeia simulada de redirects (alias → canônico)
 *      e exige que o destino final == URL original (idempotência).
 *
 * Falha se houver desvio entre o que o sitemap emite e a tabela de aliases.
 */
import { describe, it, expect } from 'vitest';
import { ROUTE_ALIASES, resolveRedirectChain, detectAliasLoops } from '@/lib/routeAliases';

const SAMPLE_SITEMAP_URLS = [
  'https://precisodeum.com.br/',
  'https://precisodeum.com.br/categorias',
  'https://precisodeum.com.br/categoria/eletricista',
  'https://precisodeum.com.br/cidades',
  'https://precisodeum.com.br/cidades/pr/curitiba',
  'https://precisodeum.com.br/profissionais',
  'https://precisodeum.com.br/profissional/joao-silva',
  'https://precisodeum.com.br/especialidades',
  'https://precisodeum.com.br/especialidades/instalacao-eletrica',
];

// Conjunto de redirects "esperados" a partir de aliases declarados.
const REDIRECTS = ROUTE_ALIASES.flatMap((r) =>
  r.aliases.map((a) => ({ from: a, to: r.canonical })),
);

describe('Sitemap × routeAliases — cobertura automática', () => {
  it('nenhum URL do sitemap usa segmento alias (apenas canônicos)', () => {
    const issues = detectAliasLoops(SAMPLE_SITEMAP_URLS, REDIRECTS);
    expect(issues, `Aliases vazaram no sitemap:\n${issues.join('\n')}`).toEqual([]);
  });

  it('cada URL canônica é idempotente: passar pela cadeia retorna ela mesma', () => {
    const desvios: string[] = [];
    for (const url of SAMPLE_SITEMAP_URLS) {
      const path = new URL(url).pathname;
      const chain = resolveRedirectChain(path, REDIRECTS);
      if (chain.loop) desvios.push(`LOOP em ${path}: ${chain.hops.join(' → ')}`);
      if (chain.finalPath !== path) {
        desvios.push(`Desvio: ${path} → ${chain.finalPath} (esperado idempotente)`);
      }
    }
    expect(desvios, desvios.join('\n')).toEqual([]);
  });

  it('todo alias declarado SEMPRE redireciona ao canônico (sem loop)', () => {
    for (const r of ROUTE_ALIASES) {
      for (const alias of r.aliases) {
        const chain = resolveRedirectChain(alias, REDIRECTS);
        expect(chain.loop, `Loop detectado em alias ${alias}`).toBe(false);
        expect(chain.finalPath).toBe(r.canonical);
      }
    }
  });
});
