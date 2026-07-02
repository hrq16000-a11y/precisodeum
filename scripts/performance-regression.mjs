import fs from 'node:fs';
import path from 'node:path';

const targets = JSON.parse(fs.readFileSync('scripts/performance-targets.json', 'utf8'));
const routeTargets = fs.existsSync('scripts/performance-targets-routes.json')
  ? JSON.parse(fs.readFileSync('scripts/performance-targets-routes.json', 'utf8'))
  : {};

const DIST = 'dist';

const fail = (message) => {
  console.error(`[perf-regression] ${message}`);
  process.exitCode = 1;
};

// Coleta TODOS os relatórios per-route (lighthouse-report.json, lighthouse-report-buscar.json, etc.).
const reports = fs.existsSync(DIST)
  ? fs.readdirSync(DIST).filter((f) => f.startsWith('lighthouse-report') && f.endsWith('.json'))
  : [];

if (reports.length === 0) {
  console.log('[perf-regression] relatório Lighthouse ainda não existe; validação será aplicada após lighthouse:ci.');
  process.exit(0);
}

/**
 * Casa um pathname (ex.: /profissional/joao-eletricista) com a chave de
 * routeTargets (ex.: /profissional/:slug). Match mais específico vence.
 */
function resolveTargets(pathname) {
  let best = null;
  let bestScore = -1;
  for (const pattern of Object.keys(routeTargets)) {
    const re = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, '[^/]+').replace(/\//g, '\\/') + '$');
    if (re.test(pathname)) {
      const score = pattern.split('/').filter(Boolean).length * 10 + (pattern.includes(':') ? 0 : 1);
      if (score > bestScore) { best = pattern; bestScore = score; }
    }
  }
  return { pattern: best, t: best ? { ...targets, ...routeTargets[best] } : targets };
}

let anyFailure = false;
for (const file of reports) {
  const report = JSON.parse(fs.readFileSync(path.join(DIST, file), 'utf8'));
  const audits = report.audits || {};
  const score = Math.round((report.categories?.performance?.score || 0) * 100);
  const metric = (key) => Number(audits[key]?.numericValue || 0);
  const url = report.finalDisplayedUrl || report.finalUrl || '/';
  const pathname = (() => { try { return new URL(url).pathname || '/'; } catch { return '/'; } })();
  const { pattern, t } = resolveTargets(pathname);

  const values = {
    score,
    lcp: metric('largest-contentful-paint'),
    inp: metric('interaction-to-next-paint') || metric('experimental-interaction-to-next-paint'),
    tbt: metric('total-blocking-time'),
    cls: metric('cumulative-layout-shift'),
    ttfb: metric('server-response-time'),
  };

  const tag = `[${pattern || 'global'} · ${pathname}]`;

  if (values.score < t.mobileScoreMin) { fail(`${tag} score ${values.score}/100 < ${t.mobileScoreMin}.`); anyFailure = true; }
  if (values.lcp > t.lcpMaxMs) { fail(`${tag} LCP ${Math.round(values.lcp)}ms > ${t.lcpMaxMs}ms.`); anyFailure = true; }
  if (values.inp && values.inp > t.inpMaxMs) { fail(`${tag} INP ${Math.round(values.inp)}ms > ${t.inpMaxMs}ms.`); anyFailure = true; }
  if (values.tbt > t.tbtMaxMs) { fail(`${tag} TBT ${Math.round(values.tbt)}ms > ${t.tbtMaxMs}ms.`); anyFailure = true; }
  if (values.cls > t.clsMax) { fail(`${tag} CLS ${values.cls.toFixed(3)} > ${t.clsMax}.`); anyFailure = true; }
  if (values.ttfb > t.ttfbMaxMs) { fail(`${tag} TTFB ${Math.round(values.ttfb)}ms > ${t.ttfbMaxMs}ms.`); anyFailure = true; }

  console.log(`[perf-regression] ${tag} score=${values.score} LCP=${Math.round(values.lcp)}ms INP=${Math.round(values.inp || 0)}ms CLS=${values.cls.toFixed(3)} TBT=${Math.round(values.tbt)}ms`);
}

if (process.exitCode) {
  console.error('[perf-regression] FAIL — métricas acima do threshold (veja dist/lighthouse-summary.md).');
  process.exit(process.exitCode);
}
console.log('[perf-regression] OK — todas as rotas dentro dos limites per-route.');
