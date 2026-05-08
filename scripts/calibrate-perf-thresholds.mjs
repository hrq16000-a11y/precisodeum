#!/usr/bin/env node
/**
 * calibrate-perf-thresholds.mjs
 *
 * Lê dist/lighthouse-summary.json (gerado por scripts/lighthouse-summary.mjs)
 * e atualiza scripts/performance-targets-routes.json com thresholds calibrados
 * a partir do baseline atual + margem (default 20% LCP/INP/TBT/TTFB, +0.03 CLS,
 * -3 score). Evita o ruído de "passa local, falha CI" sem afrouxar limites
 * absolutos: cada métrica é arredondada e nunca sobe acima do "teto" duro.
 *
 * Uso:
 *   node scripts/calibrate-perf-thresholds.mjs            # aplica margens default
 *   node scripts/calibrate-perf-thresholds.mjs --dry-run  # imprime sem gravar
 *   MARGIN=0.15 node scripts/calibrate-perf-thresholds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const MARGIN = Number(process.env.MARGIN ?? 0.2);
const DRY = process.argv.includes('--dry-run');

const summaryPath = path.join('dist', 'lighthouse-summary.json');
if (!fs.existsSync(summaryPath)) {
  console.error('[calibrate] dist/lighthouse-summary.json ausente. Rode npm run lighthouse:ci antes.');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const reports = summary.reports || [];

// Tetos absolutos — calibração nunca pode passar destes (Google "good" thresholds).
const HARD_CAPS = {
  lcpMaxMs: 3500,
  inpMaxMs: 350,
  clsMax: 0.12,
  tbtMaxMs: 400,
  ttfbMaxMs: 900,
  mobileScoreMin: 60, // piso (não teto)
};

const ROUTE_PATTERNS = {
  '/': '/',
  '/buscar': '/buscar',
  '/categoria': '/categoria/:slug',
  '/profissional': '/profissional/:slug',
  '/categoria-cidade': '/categoria/:slug/em/:cidade',
};

function patternFor(pathname) {
  if (pathname === '/' || pathname === '') return '/';
  if (pathname.startsWith('/buscar')) return '/buscar';
  if (pathname.startsWith('/categoria/') && pathname.includes('/em/')) return '/categoria/:slug/em/:cidade';
  if (pathname.startsWith('/categoria/')) return '/categoria/:slug';
  if (pathname.startsWith('/profissional/')) return '/profissional/:slug';
  return null;
}

const targetsPath = path.join('scripts', 'performance-targets-routes.json');
const current = fs.existsSync(targetsPath) ? JSON.parse(fs.readFileSync(targetsPath, 'utf8')) : {};
const next = { ...current };

for (const r of reports) {
  const pattern = patternFor(r.route || '/');
  if (!pattern) continue;
  const lcp = Math.min(HARD_CAPS.lcpMaxMs, Math.ceil(r.lcp * (1 + MARGIN) / 50) * 50);
  const inp = Math.min(HARD_CAPS.inpMaxMs, Math.max(200, Math.ceil((r.inp || 200) * (1 + MARGIN) / 25) * 25));
  const tbt = Math.min(HARD_CAPS.tbtMaxMs, Math.ceil(r.tbt * (1 + MARGIN) / 25) * 25);
  const ttfb = Math.min(HARD_CAPS.ttfbMaxMs, Math.ceil(r.ttfb * (1 + MARGIN) / 50) * 50);
  const cls = Math.min(HARD_CAPS.clsMax, Number((r.cls + 0.03).toFixed(2)));
  const score = Math.max(HARD_CAPS.mobileScoreMin, Math.max(0, (r.score || 0) - 3));

  next[pattern] = {
    lcpMaxMs: lcp,
    inpMaxMs: inp,
    clsMax: cls,
    tbtMaxMs: tbt,
    ttfbMaxMs: ttfb,
    mobileScoreMin: score,
  };
  console.log(`[calibrate] ${pattern} ← LCP≤${lcp}ms INP≤${inp}ms CLS≤${cls} TBT≤${tbt}ms TTFB≤${ttfb}ms score≥${score}`);
}

if (DRY) {
  console.log('\n[calibrate] --dry-run; arquivo NÃO foi gravado. Resultado:');
  console.log(JSON.stringify(next, null, 2));
  process.exit(0);
}

fs.writeFileSync(targetsPath, JSON.stringify(next, null, 2) + '\n');
console.log(`[calibrate] gravado em ${targetsPath}`);
