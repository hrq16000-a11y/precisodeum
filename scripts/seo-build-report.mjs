#!/usr/bin/env node
/**
 * Relatório agregado de SEO por build.
 *
 * Varre as rotas conhecidas (prerender routes + sitemap local + rotas estáticas
 * do app) e produz um sumário com:
 *   - páginas indexáveis vs noindex
 *   - canônicos por marca (quantos batem com o domínio do brand config)
 *   - links internos quebrados (href para rota inexistente)
 *
 * Saída: <out>.json e <out>.csv. Não faz rede e não altera nada — feito para
 * rodar ANTES do deploy.
 *
 * Uso: npm run seo:report -- --out=.lovable/seo-build-report --dist=dist
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

const arg = (name, fallback = '') => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const OUT = arg('out', '.lovable/seo-build-report');
const DIST = arg('dist', 'dist');
const STRICT = process.argv.includes('--strict');

/** Domínio da marca (lido de src/config/brand.ts sem importar TS). */
function readBrandBaseUrl() {
  try {
    const src = readFileSync('src/config/brand.ts', 'utf8');
    const match = src.match(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
    return (match?.[0] || 'https://www.precisodeum.com.br').replace(/\/+$/, '');
  } catch {
    return 'https://www.precisodeum.com.br';
  }
}
const BRAND_BASE = readBrandBaseUrl();
const BRAND_HOST = new URL(BRAND_BASE).host.replace(/^www\./, '');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function parseHtml(file) {
  const html = readFileSync(file, 'utf8');
  const robots = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] || '';
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] || '';
  const links = [...html.matchAll(/href=["'](\/[^"'#?]*)["']/g)].map((m) => m[1]);
  const jsonLdTypes = [
    ...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi),
  ]
    .flatMap((m) => {
      try {
        const parsed = JSON.parse(m[1]);
        return (Array.isArray(parsed) ? parsed : [parsed]).map((p) => p?.['@type']).filter(Boolean);
      } catch {
        return ['__invalid__'];
      }
    });
  return { robots, canonical, title, description, links, jsonLdTypes };
}

function pathFromFile(file) {
  const rel = relative(DIST, file).replace(/\\/g, '/');
  const p = `/${rel.replace(/index\.html$/, '').replace(/\.html$/, '')}`;
  return p.length > 1 ? p.replace(/\/$/, '') : '/';
}

const files = walk(DIST);
const rows = [];
const knownPaths = new Set(files.map(pathFromFile));

for (const file of files) {
  const meta = parseHtml(file);
  const path = pathFromFile(file);
  const noindex = /noindex/i.test(meta.robots);
  let canonicalBrand = 'missing';
  if (meta.canonical) {
    try {
      const host = new URL(meta.canonical, BRAND_BASE).host.replace(/^www\./, '');
      canonicalBrand = host === BRAND_HOST ? 'brand' : 'foreign';
    } catch {
      canonicalBrand = 'invalid';
    }
  }
  const internal = [...new Set(meta.links)].filter(
    (l) => !l.startsWith('//') && !/\.(png|jpe?g|webp|svg|ico|txt|xml|json|js|css)$/i.test(l),
  );
  const broken = internal.filter((l) => knownPaths.size > 0 && !knownPaths.has(l.replace(/\/$/, '') || '/'));

  rows.push({
    path,
    indexable: !noindex,
    robots: meta.robots || 'default',
    canonical: meta.canonical,
    canonicalBrand,
    titleLength: meta.title.length,
    descriptionLength: meta.description.length,
    jsonLdTypes: meta.jsonLdTypes.join('|'),
    internalLinks: internal.length,
    brokenLinks: broken.length,
    brokenSample: broken.slice(0, 5).join(' '),
  });
}

const summary = {
  generatedAt: new Date().toISOString(),
  brandBaseUrl: BRAND_BASE,
  dist: DIST,
  totals: {
    pages: rows.length,
    indexable: rows.filter((r) => r.indexable).length,
    noindex: rows.filter((r) => !r.indexable).length,
    canonicalBrand: rows.filter((r) => r.canonicalBrand === 'brand').length,
    canonicalForeign: rows.filter((r) => r.canonicalBrand === 'foreign').length,
    canonicalMissing: rows.filter((r) => r.canonicalBrand === 'missing').length,
    brokenLinks: rows.reduce((a, r) => a + r.brokenLinks, 0),
    invalidJsonLd: rows.filter((r) => r.jsonLdTypes.includes('__invalid__')).length,
  },
  pages: rows,
};

const outPath = resolve(OUT);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(`${outPath}.json`, JSON.stringify(summary, null, 2));

const headers = Object.keys(rows[0] || { path: '' });
const csv = [
  headers.join(','),
  ...rows.map((r) =>
    headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','),
  ),
].join('\n');
writeFileSync(`${outPath}.csv`, csv);

const t = summary.totals;
console.log(`SEO build report -> ${outPath}.json / .csv`);
console.log(
  `páginas: ${t.pages} | indexáveis: ${t.indexable} | noindex: ${t.noindex} | canonical marca: ${t.canonicalBrand} | fora da marca: ${t.canonicalForeign} | sem canonical: ${t.canonicalMissing} | links quebrados: ${t.brokenLinks}`,
);

if (t.pages === 0) {
  console.warn(`Nenhum HTML encontrado em "${DIST}" — rode o build/prerender antes.`);
}

if (STRICT && (t.canonicalForeign > 0 || t.brokenLinks > 0 || t.invalidJsonLd > 0)) {
  console.error('Relatório em modo strict falhou: canônico fora da marca, link quebrado ou JSON-LD inválido.');
  process.exit(1);
}
