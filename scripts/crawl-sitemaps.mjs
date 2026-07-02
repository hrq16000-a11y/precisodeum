#!/usr/bin/env node
/**
 * Crawl smoke-test dos sub-sitemaps SEO-críticos (/categoria, /cidade, /profissional).
 *
 * Para cada sub-sitemap (com paginação), baixa o XML, extrai as <loc> e faz HEAD
 * em uma amostra para validar que respondem 200. Falha se >5% das URLs amostradas
 * retornarem erro HTTP.
 *
 * Uso:
 *   SITE_BASE=https://precisodeum.com.br node scripts/crawl-sitemaps.mjs
 *
 * Pulado em CI quando a env SKIP_SITEMAP_CRAWL=1 (default em PRs sem rede).
 */

const SITE_BASE = process.env.SITE_BASE || 'https://precisodeum.com.br';
const SAMPLE_PER_TYPE = parseInt(process.env.SITEMAP_SAMPLE || '20', 10);
const SKIP = process.env.SKIP_SITEMAP_CRAWL === '1';
const TYPES = ['providers', 'cities', 'categories'];

if (SKIP) {
  console.log('↷ Crawl de sitemaps pulado (SKIP_SITEMAP_CRAWL=1).');
  process.exit(0);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'precisodeum-crawl-bot/1.0' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

function extractLocs(xml) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
}

function pickSample(arr, n) {
  if (arr.length <= n) return arr;
  const out = [];
  const step = Math.floor(arr.length / n);
  for (let i = 0; i < arr.length && out.length < n; i += step) out.push(arr[i]);
  return out;
}

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return { url, ok: res.ok, status: res.status };
  } catch (e) {
    return { url, ok: false, status: 0, error: String(e) };
  }
}

async function main() {
  let totalChecked = 0;
  let totalErrors = 0;
  for (const type of TYPES) {
    const indexUrl = `${SITE_BASE}/sitemap?type=${type}`;
    console.log(`\n▸ ${type}: ${indexUrl}`);
    let xml;
    try {
      xml = await fetchText(indexUrl);
    } catch (e) {
      console.error(`  ✗ Falhou ao baixar: ${e.message}`);
      totalErrors++;
      continue;
    }
    const locs = extractLocs(xml);
    console.log(`  ${locs.length} URLs no sub-sitemap`);
    const sample = pickSample(locs, SAMPLE_PER_TYPE);
    const results = await Promise.all(sample.map(checkUrl));
    const failed = results.filter((r) => !r.ok);
    totalChecked += results.length;
    totalErrors += failed.length;
    for (const f of failed) console.error(`    ✗ ${f.status} ${f.url}`);
    console.log(`  ${results.length - failed.length}/${results.length} OK`);
  }

  const errorRate = totalChecked > 0 ? totalErrors / totalChecked : 0;
  console.log(`\nResumo: ${totalChecked - totalErrors}/${totalChecked} OK (${(errorRate * 100).toFixed(1)}% erro)`);
  if (errorRate > 0.05) {
    console.error('✗ Taxa de erro acima de 5% — falhando o build.');
    process.exit(1);
  }
  console.log('✓ Crawl OK');
}

main().catch((e) => {
  console.error('Erro inesperado:', e);
  process.exit(1);
});
