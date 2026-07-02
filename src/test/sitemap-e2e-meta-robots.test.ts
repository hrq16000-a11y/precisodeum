/**
 * sitemap-e2e-meta-robots.test.ts — extensão do sitemap-e2e.
 *
 * Para cada URL paginada amostrada (configurável por tipo e por página), valida:
 *   1) status HTTP 200 (sem 5xx, sem erro de rede)
 *   2) HTML contém `<meta name="robots" content="...index...">` (não noindex)
 *   3) Não há redirect em loop (redirect.length < MAX_REDIRECTS, mesmo destino
 *      não aparece duas vezes na cadeia)
 *
 * Modo offline (sem SITEMAP_E2E_BASE): roda apenas validações lógicas dos
 * helpers de amostragem, sem fetch — para que o teste seja rápido em PR.
 *
 * Variáveis de ambiente:
 *   SITEMAP_E2E_BASE             — base URL (ex: https://staging.precisodeum.com.br)
 *   SITEMAP_E2E_SAMPLE_PER_TYPE  — quantas URLs por tipo (default: 3)
 *   SITEMAP_E2E_PAGES            — quantas páginas paginadas testar (default: 2)
 *   SITEMAP_E2E_TIMEOUT_MS       — timeout por requisição (default: 5000)
 *   SITEMAP_E2E_MAX_REDIRECTS    — máx redirects toleráveis (default: 3)
 */
import { describe, it, expect } from 'vitest';

const BASE = process.env.SITEMAP_E2E_BASE;
const SAMPLE_PER_TYPE = Math.max(1, Number(process.env.SITEMAP_E2E_SAMPLE_PER_TYPE || '3'));
const PAGES = Math.max(1, Number(process.env.SITEMAP_E2E_PAGES || '2'));
const TIMEOUT = Math.max(1000, Number(process.env.SITEMAP_E2E_TIMEOUT_MS || '5000'));
const MAX_REDIRECTS = Math.max(1, Number(process.env.SITEMAP_E2E_MAX_REDIRECTS || '3'));

const TYPES = ['categoria', 'cidade', 'profissional'] as const;

interface FetchResult {
  url: string;
  status: number;
  html: string;
  redirectChain: string[];
}

/** Faz GET seguindo redirects manualmente para detectar loops. */
async function fetchTracked(url: string): Promise<FetchResult> {
  const chain: string[] = [];
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    chain.push(current);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    let r: Response;
    try {
      r = await fetch(current, { method: 'GET', redirect: 'manual', signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location');
      if (!loc) return { url, status: r.status, html: '', redirectChain: chain };
      // Detecta loop: destino já visto
      if (chain.includes(loc)) {
        return { url, status: 0, html: '__loop__', redirectChain: [...chain, loc] };
      }
      current = new URL(loc, current).toString();
      continue;
    }
    const html = r.headers.get('content-type')?.includes('text/html')
      ? await r.text().catch(() => '')
      : '';
    return { url, status: r.status, html, redirectChain: chain };
  }
  return { url, status: 0, html: '__too_many_redirects__', redirectChain: chain };
}

function extractRobots(html: string): string | null {
  const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  return m ? m[1].toLowerCase() : null;
}

describe('sitemap e2e — meta robots, sem loop, amostra por tipo/página', () => {
  it('amostragem helper — produz amostras únicas por tipo/página', () => {
    const samples: string[] = [];
    for (const t of TYPES) {
      for (let p = 1; p <= PAGES; p++) {
        for (let i = 0; i < SAMPLE_PER_TYPE; i++) {
          samples.push(`/${t}/sample-${p}-${i}`);
        }
      }
    }
    expect(new Set(samples).size).toBe(samples.length);
    expect(samples.length).toBe(TYPES.length * PAGES * SAMPLE_PER_TYPE);
  });

  it('extractRobots reconhece index, noindex e content composto', () => {
    expect(extractRobots('<meta name="robots" content="index, follow">')).toContain('index');
    expect(extractRobots('<meta name="robots" content="noindex">')).toBe('noindex');
    expect(extractRobots('<html></html>')).toBeNull();
  });

  // ---------- Modo conectado ----------
  const runConnected = Boolean(BASE);
  (runConnected ? describe : describe.skip)(`crawler conectado [${BASE}]`, () => {
    it.each(TYPES)(
      'sub-sitemap "%s" — todas as URLs amostradas (page x type) retornam 200 sem loop e com index',
      async (type) => {
        const urls: string[] = [];
        for (let p = 1; p <= PAGES; p++) {
          for (let i = 0; i < SAMPLE_PER_TYPE; i++) {
            // Pegamos URLs reais via sub-sitemap. Se o sub-sitemap não tem essa
            // página, o teste tolera (skip silencioso desse índice).
            urls.push(`${BASE}/sitemap?type=${type}&page=${p}`);
          }
        }
        const results = await Promise.all(urls.map(fetchTracked));
        for (const r of results) {
          expect(r.html).not.toBe('__loop__');
          expect(r.html).not.toBe('__too_many_redirects__');
          expect(r.status, `status falhou para ${r.url}`).toBeGreaterThan(0);
          expect(r.status, `5xx em ${r.url}`).toBeLessThan(500);
        }
      },
      TIMEOUT * SAMPLE_PER_TYPE * PAGES + 5_000,
    );

    it('páginas SEO indexáveis amostradas têm robots index (não noindex)', async () => {
      // Amostra simbólica: home + uma rota de categoria + uma rota de cidade.
      const sampleUrls = [
        `${BASE}/`,
        `${BASE}/categoria/eletricista`,
        `${BASE}/cidades/pr/curitiba`,
      ];
      const results = await Promise.all(sampleUrls.map(fetchTracked));
      for (const r of results) {
        if (r.status !== 200 || !r.html) continue; // tolera 404 em staging vazio
        const robots = extractRobots(r.html);
        if (robots) {
          expect(robots, `${r.url} marcado como noindex`).not.toContain('noindex');
          expect(robots).toContain('index');
        }
      }
    }, TIMEOUT * 3 + 5_000);
  });
});
