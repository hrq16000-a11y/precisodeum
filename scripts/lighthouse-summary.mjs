#!/usr/bin/env node
/**
 * lighthouse-summary.mjs
 *
 * Lê dist/lighthouse-report.json (e variantes per-route, se houver) e gera:
 *  - dist/lighthouse-summary.md (markdown human-readable, anexo do CI)
 *  - dist/lighthouse-summary.json (machine-readable, gates downstream)
 *
 * Para cada rota, extrai LCP/CLS/INP/TBT/TTFB, top 5 oportunidades, e tenta
 * mapear cada oportunidade para arquivos do repo via:
 *   - LCP element snippet → grep em src/
 *   - render-blocking / unused-* → match no nome do chunk em dist/assets/
 *
 * Heurística não é perfeita, mas dá ao desenvolvedor o ponteiro inicial
 * sem precisar abrir o JSON de 5MB do Lighthouse.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DIST = path.join(process.cwd(), 'dist');
const TARGETS = JSON.parse(fs.readFileSync('scripts/performance-targets.json', 'utf8'));
const ROUTE_TARGETS = fs.existsSync('scripts/performance-targets-routes.json')
  ? JSON.parse(fs.readFileSync('scripts/performance-targets-routes.json', 'utf8'))
  : {};

const reports = fs.existsSync(DIST)
  ? fs.readdirSync(DIST).filter((f) => f.startsWith('lighthouse-report') && f.endsWith('.json'))
  : [];

if (reports.length === 0) {
  console.log('[lh-summary] nenhum lighthouse-report*.json em dist/. Nada a resumir.');
  process.exit(0);
}

function chunkForLcpSnippet(snippet) {
  if (!snippet || typeof snippet !== 'string') return null;
  const classMatch = snippet.match(/class=["']([^"']+)["']/);
  if (!classMatch) return null;
  const tokens = classMatch[1].split(/\s+/).filter((t) => t.length > 4 && !t.startsWith('h-') && !t.startsWith('w-'));
  if (tokens.length === 0) return null;
  try {
    const out = execSync(`rg -l --max-count 1 ${JSON.stringify(tokens[0])} src 2>/dev/null | head -3`, { encoding: 'utf8' }).trim();
    return out ? out.split('\n') : null;
  } catch {
    return null;
  }
}

function mapItemsToFiles(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 5).map((it) => {
    const target = it.url || it.source || it.entity || it.node?.snippet || '';
    const fileGuess = (() => {
      if (!target) return null;
      const m = String(target).match(/\/assets\/([^?#"]+\.js)/);
      if (m) return `dist/assets/${m[1]}`;
      const compName = String(target).match(/(SearchPage|CategoryPage|CategoryCityPage|ProviderProfile|Index|Header|ProviderCard)/);
      if (compName) return `src/**/*${compName[1]}*`;
      return null;
    })();
    return { hint: String(target).slice(0, 160), file: fileGuess };
  });
}

const summary = [];
for (const file of reports) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIST, file), 'utf8'));
  const audits = raw.audits || {};
  const num = (k) => Number(audits[k]?.numericValue || 0);
  const url = raw.finalDisplayedUrl || raw.finalUrl || '/';
  const route = (() => {
    try { return new URL(url).pathname || '/'; } catch { return '/'; }
  })();
  const score = Math.round((raw.categories?.performance?.score || 0) * 100);
  const lcpSnippet = audits['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet;
  const lcpFiles = chunkForLcpSnippet(lcpSnippet);

  const opportunities = Object.entries(audits)
    .filter(([, a]) => a?.score !== null && a?.score !== undefined && a.score < 0.9 && a.details?.items?.length)
    .sort((a, b) => (b[1].numericValue || 0) - (a[1].numericValue || 0))
    .slice(0, 5)
    .map(([id, a]) => ({ id, title: a.title, savingsMs: Math.round(a.numericValue || 0), files: mapItemsToFiles(a.details.items) }));

  summary.push({
    file, route, score,
    lcp: Math.round(num('largest-contentful-paint')),
    cls: Number(num('cumulative-layout-shift').toFixed(3)),
    inp: Math.round(num('interaction-to-next-paint') || num('experimental-interaction-to-next-paint')),
    tbt: Math.round(num('total-blocking-time')),
    ttfb: Math.round(num('server-response-time')),
    lcpElement: lcpSnippet ? lcpSnippet.slice(0, 140) : null,
    lcpFiles, opportunities,
  });
}

fs.writeFileSync(path.join(DIST, 'lighthouse-summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), targets: TARGETS, routeTargets: ROUTE_TARGETS, reports: summary }, null, 2));

const md = ['# Lighthouse summary', '', `_Gerado em ${new Date().toISOString()}_`, ''];
for (const r of summary) {
  const t = ROUTE_TARGETS[r.route] || TARGETS;
  const flag = (val, max, lower = true) => (lower ? val > max : val < max) ? ' ⚠️' : '';
  md.push(`## ${r.route} · score ${r.score}${flag(r.score, t.mobileScoreMin || TARGETS.mobileScoreMin, false)}`);
  md.push('');
  md.push(`| Métrica | Valor | Alvo |`);
  md.push(`|---|---|---|`);
  md.push(`| LCP | ${r.lcp}ms${flag(r.lcp, t.lcpMaxMs || TARGETS.lcpMaxMs)} | ${t.lcpMaxMs || TARGETS.lcpMaxMs}ms |`);
  md.push(`| CLS | ${r.cls}${flag(r.cls, t.clsMax || TARGETS.clsMax)} | ${t.clsMax || TARGETS.clsMax} |`);
  md.push(`| INP | ${r.inp || '—'}ms${r.inp ? flag(r.inp, t.inpMaxMs || TARGETS.inpMaxMs) : ''} | ${t.inpMaxMs || TARGETS.inpMaxMs}ms |`);
  md.push(`| TBT | ${r.tbt}ms${flag(r.tbt, t.tbtMaxMs || TARGETS.tbtMaxMs)} | ${t.tbtMaxMs || TARGETS.tbtMaxMs}ms |`);
  md.push(`| TTFB | ${r.ttfb}ms${flag(r.ttfb, t.ttfbMaxMs || TARGETS.ttfbMaxMs)} | ${t.ttfbMaxMs || TARGETS.ttfbMaxMs}ms |`);
  md.push('');
  if (r.lcpElement) {
    md.push(`**LCP element**: \`${r.lcpElement}\``);
    if (r.lcpFiles?.length) md.push(`Arquivos prováveis: ${r.lcpFiles.map((f) => `\`${f}\``).join(', ')}`);
    md.push('');
  }
  if (r.opportunities.length) {
    md.push('**Top oportunidades:**');
    for (const o of r.opportunities) {
      md.push(`- **${o.title}** (~${o.savingsMs}ms)`);
      for (const f of o.files) md.push(`  - \`${f.hint}\`${f.file ? ` → \`${f.file}\`` : ''}`);
    }
    md.push('');
  }
}
fs.writeFileSync(path.join(DIST, 'lighthouse-summary.md'), md.join('\n'));
console.log('[lh-summary] dist/lighthouse-summary.{md,json} gerados.');
console.log(summary.map((r) => `  ${r.route} · score=${r.score} LCP=${r.lcp}ms CLS=${r.cls} TBT=${r.tbt}ms`).join('\n'));
