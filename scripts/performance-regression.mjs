import fs from 'node:fs';

const targets = JSON.parse(fs.readFileSync('scripts/performance-targets.json', 'utf8'));
const reportPath = 'dist/lighthouse-report.json';

const fail = (message) => {
  console.error(`[perf-regression] ${message}`);
  process.exitCode = 1;
};

if (!fs.existsSync(reportPath)) {
  console.log('[perf-regression] relatório Lighthouse ainda não existe; validação será aplicada após lighthouse:ci.');
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const audits = report.audits || {};
const score = Math.round((report.categories?.performance?.score || 0) * 100);
const metric = (key) => Number(audits[key]?.numericValue || 0);

const values = {
  score,
  lcp: metric('largest-contentful-paint'),
  inp: metric('interaction-to-next-paint'),
  tbt: metric('total-blocking-time'),
  cls: metric('cumulative-layout-shift'),
  ttfb: metric('server-response-time'),
};

if (values.score < targets.mobileScoreMin) fail(`PageSpeed mobile ${values.score}, abaixo da meta ${targets.mobileScoreMin}/100.`);
if (values.lcp > targets.lcpMaxMs) fail(`LCP ${Math.round(values.lcp)}ms > ${targets.lcpMaxMs}ms. Rota: ${report.finalDisplayedUrl || report.finalUrl}.`);
if (values.inp > targets.inpMaxMs) fail(`INP ${Math.round(values.inp)}ms > ${targets.inpMaxMs}ms. Revisar handlers e JS inicial.`);
if (values.tbt > targets.tbtMaxMs) fail(`TBT ${Math.round(values.tbt)}ms > ${targets.tbtMaxMs}ms. Provável regressão de bundle/execução.`);
if (values.cls > targets.clsMax) fail(`CLS ${values.cls.toFixed(3)} > ${targets.clsMax}. Revisar dimensões do Hero/Header.`);
if (values.ttfb > targets.ttfbMaxMs) fail(`TTFB ${Math.round(values.ttfb)}ms > ${targets.ttfbMaxMs}ms. Revisar cache HTTP/CDN.`);

const opportunities = Object.values(audits)
  .filter((audit) => audit?.score !== null && audit?.score !== undefined && audit.score < 0.9 && audit.details?.items?.length)
  .slice(0, 6)
  .map((audit) => `${audit.title}: ${audit.details.items.slice(0, 3).map((item) => item.url || item.source || item.node?.snippet || item.entity || '').filter(Boolean).join(' | ')}`)
  .filter(Boolean);

if (opportunities.length) {
  console.log('[perf-regression] Principais rotas/arquivos suspeitos:');
  for (const item of opportunities) console.log(`- ${item}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`[perf-regression] OK — mobile ${values.score}/100, LCP ${Math.round(values.lcp)}ms, TBT ${Math.round(values.tbt)}ms, CLS ${values.cls.toFixed(3)}.`);