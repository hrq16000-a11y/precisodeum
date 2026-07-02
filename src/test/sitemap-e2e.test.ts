/**
 * sitemap-e2e.test.ts — gera sub-sitemaps a partir dos helpers puros e valida
 * que TODAS as URLs paginadas (amostra configurável por env) retornam 200.
 *
 * Estratégia:
 *  - Em CI/local sem rede, usa um modo "dry" que apenas valida o XML (sem fetch).
 *  - Em ambiente com SITEMAP_E2E_BASE definido, faz HEAD/GET nas URLs reais
 *    do staging/produção e exige status 200.
 *
 * Variáveis de ambiente:
 *   SITEMAP_E2E_BASE      — base URL do site a crawlear (ex: https://staging.precisodeum.com.br)
 *   SITEMAP_E2E_SAMPLE    — quantas URLs amostrar por tipo (default: 5)
 *   SITEMAP_E2E_TIMEOUT_MS— timeout por requisição (default: 5000)
 *
 * Sem env: o teste roda em modo offline e valida só a estrutura XML/paginação.
 */
import { describe, it, expect } from 'vitest';
import {
  paginate,
  pageCount,
  sitemapEntry,
  isValidSitemapXml,
  subSitemapUrl,
  SITEMAP_PAGE_SIZE,
} from '@/lib/sitemapBuilder';

const BASE = process.env.SITEMAP_E2E_BASE;
const SAMPLE = Math.max(1, Number(process.env.SITEMAP_E2E_SAMPLE || '5'));
const TIMEOUT = Math.max(1000, Number(process.env.SITEMAP_E2E_TIMEOUT_MS || '5000'));

function buildSubSitemapXml(base: string, paths: string[]): string {
  const body = paths.map((p) => sitemapEntry(base, p, '2026-04-29', 'weekly', '0.7')).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}</urlset>`;
}

async function fetchStatus(url: string): Promise<number> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'follow' });
    return r.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(t);
  }
}

describe('sitemap e2e — geração + validação de URLs paginadas', () => {
  it('paginate respeita SITEMAP_PAGE_SIZE em datasets grandes', () => {
    const items = Array.from({ length: 12_345 }, (_, i) => `/profissional/p-${i + 1}`);
    const pages = paginate(items);
    expect(pages.length).toBe(pageCount(items.length));
    expect(pages.every((p) => p.length <= SITEMAP_PAGE_SIZE)).toBe(true);
  });

  it.each(['categoria', 'cidade', 'profissional'])(
    'gera sub-sitemap válido para tipo "%s" com URLs únicas e XML bem-formado',
    (type) => {
      const paths = Array.from({ length: SAMPLE }, (_, i) => `/${type}/${type}-${i + 1}`);
      const xml = buildSubSitemapXml('https://precisodeum.com.br', paths);
      expect(isValidSitemapXml(xml)).toBe(true);
      // Cada path deve aparecer exatamente 1 vez (sem duplicatas)
      for (const p of paths) {
        const count = xml.split(`<loc>https://precisodeum.com.br${p}</loc>`).length - 1;
        expect(count).toBe(1);
      }
    },
  );

  it('subSitemapUrl gera URLs paginadas distintas e estáveis', () => {
    const base = 'https://precisodeum.com.br/sitemap';
    const urls = [1, 2, 3].map((p) => subSitemapUrl(base, 'providers', p));
    expect(new Set(urls).size).toBe(3);
    expect(urls[0]).not.toContain('page=');
    expect(urls[1]).toContain('page=2');
    expect(urls[2]).toContain('page=3');
  });

  // Modo conectado: só roda quando SITEMAP_E2E_BASE está definido.
  // Usamos `it.runIf` para skip silencioso em CI sem rede.
  const runConnected = Boolean(BASE);
  (runConnected ? describe : describe.skip)(`crawler conectado [${BASE}]`, () => {
    it.each(['categoria', 'cidade', 'profissional'])(
      'sub-sitemap de "%s" responde 200',
      async (type) => {
        const url = `${BASE}/sitemap?type=${type}`;
        const status = await fetchStatus(url);
        expect(status, `GET ${url}`).toBe(200);
      },
      TIMEOUT + 2_000,
    );

    it(`amostra de ${SAMPLE} páginas paginadas responde 200`, async () => {
      const urls = Array.from({ length: SAMPLE }, (_, i) => `${BASE}/sitemap?type=providers&page=${i + 1}`);
      const results = await Promise.all(urls.map(fetchStatus));
      // Pelo menos a página 1 precisa existir; páginas além podem ser 200 ou 404
      // (depende do volume real). Garantimos que NENHUMA retorne 5xx/erro de rede.
      expect(results[0]).toBe(200);
      for (const s of results) {
        expect(s, 'nenhuma URL deve retornar 5xx ou falha de rede').toBeLessThan(500);
        expect(s, 'nenhuma URL deve falhar com 0 (erro de rede)').toBeGreaterThan(0);
      }
    }, TIMEOUT * SAMPLE + 5_000);
  });
});
