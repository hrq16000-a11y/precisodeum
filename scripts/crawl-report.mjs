#!/usr/bin/env node
/**
 * Crawl reporter: lê (ou regenera) os sub-sitemaps configurados e produz dois
 * artefatos para o CI / debugging local:
 *
 *   - reports/sitemap-crawl.json — formato máquina (CI gates, métricas)
 *   - reports/sitemap-crawl.html — formato leitura (lista de URLs ofensoras
 *     com motivo: status != 200, robots noindex, loop de redirect, alias)
 *
 * Configuração via env:
 *   - SITEMAP_BASE          (ex.: https://staging.precisodeum.com.br)
 *   - SITEMAP_TYPES         (csv: categoria,cidade,profissional — default todos)
 *   - SITEMAP_SAMPLE_PER_TYPE (default 25)
 *
 * Uso:
 *   node scripts/crawl-report.mjs
 *
 * Exit code != 0 quando há URLs ofensoras (CI bloqueia merge).
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SITEMAP_BASE || 'https://precisodeum.com.br';
const TYPES = (process.env.SITEMAP_TYPES || 'categoria,cidade,profissional')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const SAMPLE = Number(process.env.SITEMAP_SAMPLE_PER_TYPE || 25);
const TIMEOUT_MS = 8000;
const REDIRECT_LIMIT = 5;

const ALIAS_MAP = new Map([
  ['/cidade', '/cidades'],
  ['/categoria-list', '/categorias'],
  ['/prestadores', '/profissionais'],
]);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function fetchSitemapUrls(type) {
  const url = `${BASE}/sitemap.xml?type=${encodeURIComponent(type)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { urls: [], error: `sitemap retornou ${res.status}` };
    const xml = await res.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    return { urls: urls.slice(0, SAMPLE), error: null };
  } catch (err) {
    return { urls: [], error: err.message };
  }
}

async function crawlOne(url) {
  const hops = [url];
  let current = url;
  for (let i = 0; i < REDIRECT_LIMIT; i++) {
    let res;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      return { url, finalUrl: current, status: 0, robots: null, hops, reason: `fetch_error: ${err.message}` };
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { url, finalUrl: current, status: res.status, robots: null, hops, reason: 'redirect_sem_location' };
      const next = new URL(loc, current).toString();
      if (hops.includes(next)) {
        return { url, finalUrl: next, status: res.status, robots: null, hops: [...hops, next], reason: 'redirect_loop' };
      }
      hops.push(next);
      current = next;
      continue;
    }

    const html = await res.text();
    const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
    const robots = robotsMatch ? robotsMatch[1].toLowerCase() : null;
    const reasons = [];
    if (res.status !== 200) reasons.push(`status_${res.status}`);
    if (robots && robots.includes('noindex')) reasons.push(`robots_${robots.replace(/\s+/g, '')}`);
    const seg = '/' + new URL(current).pathname.split('/').filter(Boolean)[0];
    if (ALIAS_MAP.has(seg)) reasons.push(`alias_should_be_${ALIAS_MAP.get(seg)}`);

    return { url, finalUrl: current, status: res.status, robots, hops, reason: reasons.join(',') || null };
  }
  return { url, finalUrl: current, status: 0, robots: null, hops, reason: 'too_many_redirects' };
}

function renderHtml(report) {
  const rows = report.failures
    .map(
      (f) => `<tr>
      <td>${f.type}</td>
      <td><a href="${f.url}">${f.url}</a></td>
      <td>${f.finalUrl !== f.url ? `<a href="${f.finalUrl}">${f.finalUrl}</a>` : '—'}</td>
      <td>${f.status}</td>
      <td>${f.robots || '—'}</td>
      <td><code>${f.reason}</code></td>
    </tr>`,
    )
    .join('');
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Sitemap crawl report</title>
<style>body{font:14px system-ui;padding:24px;background:#0f172a;color:#e2e8f0}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #334155;padding:8px;text-align:left;vertical-align:top}
th{background:#1e293b}code{color:#fbbf24}.ok{color:#34d399}.bad{color:#f87171}
</style></head><body>
<h1>Sitemap crawl — ${report.base}</h1>
<p>Total: <strong>${report.total}</strong> · OK: <strong class="ok">${report.ok}</strong> · Falhas: <strong class="bad">${report.failures.length}</strong></p>
<table><thead><tr><th>Tipo</th><th>URL</th><th>Final</th><th>Status</th><th>Robots</th><th>Motivo</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">Sem falhas 🎉</td></tr>'}</tbody></table>
</body></html>`;
}

(async function main() {
  console.log(`[crawl-report] base=${BASE} types=${TYPES.join(',')} sample=${SAMPLE}`);
  const report = { base: BASE, generatedAt: new Date().toISOString(), total: 0, ok: 0, failures: [] };

  for (const type of TYPES) {
    const { urls, error } = await fetchSitemapUrls(type);
    if (error) {
      report.failures.push({ type, url: `${BASE}/sitemap.xml?type=${type}`, finalUrl: '', status: 0, robots: null, hops: [], reason: `sitemap_error: ${error}` });
      continue;
    }
    for (const u of urls) {
      report.total++;
      const r = await crawlOne(u);
      if (r.reason) report.failures.push({ type, ...r });
      else report.ok++;
    }
  }

  ensureDir('reports');
  fs.writeFileSync('reports/sitemap-crawl.json', JSON.stringify(report, null, 2));
  fs.writeFileSync('reports/sitemap-crawl.html', renderHtml(report));
  console.log(`[crawl-report] gravado: reports/sitemap-crawl.{json,html}`);
  console.log(`[crawl-report] OK=${report.ok}/${report.total} falhas=${report.failures.length}`);

  if (report.failures.length > 0) process.exit(1);
})();
