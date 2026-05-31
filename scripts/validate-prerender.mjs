#!/usr/bin/env node
// scripts/validate-prerender.mjs
// Varre dist/ e valida que rotas SEO-críticas (categoria/cidade/profissional)
// têm <title> específico (não o título genérico do shell), <meta description>
// não-vazio e <link rel=canonical>. Emite dist/prerender-validation.json e
// retorna exit-code 1 se houver páginas com fallback genérico.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

// Título do shell (index.html). Páginas SEO-críticas NÃO podem manter este
// título — significa que o Helmet dinâmico nunca aplicou.
const SHELL_TITLE = (() => {
  try {
    const shell = readFileSync(join(DIST, 'index.html'), 'utf-8');
    const m = shell.match(/<title>([^<]*)<\/title>/i);
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
})();

const SEO_PREFIXES = ['categoria/', 'cidade/', 'profissional/'];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (entry === 'index.html') acc.push(p);
  }
  return acc;
}

function extract(html) {
  const titleM = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const descM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const canonM = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const ldM = html.match(/<script[^>]+application\/ld\+json/i);
  return {
    title: titleM ? titleM[1].trim() : '',
    description: descM ? descM[1].trim() : '',
    canonical: canonM ? canonM[1].trim() : '',
    hasJsonLd: !!ldM,
  };
}

if (!existsSync(DIST)) {
  console.error('[validate-prerender] dist/ ausente. Rode npm run build antes.');
  process.exit(1);
}

const files = walk(DIST);
const report = { shellTitle: SHELL_TITLE, total: 0, seoTotal: 0, failures: [], warnings: [], ok: 0 };

for (const file of files) {
  const route = '/' + relative(DIST, file).replace(/\\/g, '/').replace(/\/index\.html$/, '').replace(/^index\.html$/, '');
  report.total += 1;
  const rel = relative(DIST, file).replace(/\\/g, '/');
  const isSeo = SEO_PREFIXES.some(p => rel.startsWith(p));
  if (!isSeo) continue;
  report.seoTotal += 1;

  const html = readFileSync(file, 'utf-8');
  const { title, description, canonical, hasJsonLd } = extract(html);

  const issues = [];
  if (!title) issues.push('title-empty');
  else if (SHELL_TITLE && title === SHELL_TITLE) issues.push('title-equals-shell');
  if (!description || description.length < 10) issues.push('description-missing');
  if (!canonical) issues.push('canonical-missing');
  if (!hasJsonLd) report.warnings.push({ route, kind: 'jsonld-missing' });

  if (issues.length) {
    report.failures.push({ route, issues, title, description: description.slice(0, 80) });
  } else {
    report.ok += 1;
  }
}

writeFileSync(join(DIST, 'prerender-validation.json'), JSON.stringify(report, null, 2));

console.log(`[validate-prerender] HTMLs totais: ${report.total} | rotas SEO: ${report.seoTotal} | OK: ${report.ok} | falhas: ${report.failures.length} | avisos: ${report.warnings.length}`);
console.log(`[validate-prerender] Shell title: "${SHELL_TITLE}"`);

if (report.failures.length) {
  console.log('\n[validate-prerender] Primeiras 10 falhas:');
  for (const f of report.failures.slice(0, 10)) {
    console.log(`  ✗ ${f.route} — ${f.issues.join(', ')} — title="${f.title.slice(0, 60)}"`);
  }
  process.exit(1);
}

console.log('[validate-prerender] Todas as rotas SEO têm metadata específica.');
