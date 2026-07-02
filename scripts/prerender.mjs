#!/usr/bin/env node
// scripts/prerender.mjs
// Prerender estático usando @playwright/test (já instalado) — zero dep nova.
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePrerenderRoutes } from './generate-prerender-routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');
const PORT = 4173;
const CONCURRENCY = 2;
const TIMEOUT_STATIC = 10_000;
const TIMEOUT_DYNAMIC = 15_000;

// Rotas cujo título pode legitimamente ser igual ao shell (Home, listas
// genéricas). Para elas, basta esperar o React montar.
const STATIC_ROUTES = ['/', '/categorias', '/cidades', '/buscar', '/ajuda', '/sobre', '/contato', '/blog'];

function isStaticRoute(route) {
  return STATIC_ROUTES.some(s => route === s || route.startsWith(s + '/'));
}

async function renderRoute(browser, baseUrl, route) {
  const staticRoute = isStaticRoute(route);
  const timeout = staticRoute ? TIMEOUT_STATIC : TIMEOUT_DYNAMIC;

  const page = await browser.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,woff,woff2}', r => r.abort());
  // Bloquear WebSockets (Supabase Realtime) — sem isso o prerender trava.
  await page.route('wss://**', r => r.abort());
  await page.route('ws://**', r => r.abort());

  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout });

    if (staticRoute) {
      // Para rotas estáticas: apenas garantir que o React montou.
      await page.waitForSelector('#root > *', { timeout });
    } else {
      // Para rotas dinâmicas: aguardar o componente da página marcar
      // data-seo-ready="true" — sinal explícito de que os dados reais
      // hidrataram e o react-helmet-async já injetou o título correto.
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-seo-ready="true"]');
          const hasContent = !!document.querySelector('#root > *');
          return !!el && hasContent;
        },
        { timeout },
      );
    }


    const html = await page.content();

    const filePath = route === '/'
      ? join(DIST, 'index.html')
      : join(DIST, route.replace(/^\//, ''), 'index.html');

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, html, 'utf-8');
    process.stdout.write(`  ✓ ${route}\n`);
    return { route, ok: true, bytes: Buffer.byteLength(html, 'utf-8') };
  } catch (err) {
    process.stdout.write(`  ✗ ${route}: ${err.message}\n`);
    return { route, ok: false, error: err.message };
  } finally {
    await page.close().catch(() => {});
  }
}

async function renderRouteWithTimeout(browser, baseUrl, route) {
  const hardLimit = (isStaticRoute(route) ? TIMEOUT_STATIC : TIMEOUT_DYNAMIC) + 2_000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`hard-timeout após ${hardLimit}ms`)), hardLimit),
  );
  return Promise.race([
    renderRoute(browser, baseUrl, route),
    timeoutPromise,
  ]).catch(err => {
    process.stdout.write(`  ✗ ${route}: ${err.message}\n`);
    return { route, ok: false, error: err.message };
  });
}

async function main() {
  const server = await preview({
    preview: { port: PORT, strictPort: true, open: false },
  });
  const baseUrl = `http://localhost:${PORT}`;
  const routes = await generatePrerenderRoutes();

  process.stdout.write(`\n[prerender] Iniciando: ${routes.length} rotas | concorrência: ${CONCURRENCY}\n\n`);

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const results = [];
  let done = 0;
  for (let i = 0; i < routes.length; i += CONCURRENCY) {
    const batch = routes.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(r => renderRouteWithTimeout(browser, baseUrl, r)));
    results.push(...batchResults.filter(Boolean));
    done += batch.length;
    process.stdout.write(`  [${done}/${routes.length}] concluídos\n`);
  }

  await browser.close();
  server.httpServer.close();

  const ok = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  const report = {
    generated_at: new Date().toISOString(),
    total: routes.length,
    ok: ok.length,
    failed: failed.length,
    bytes_total: ok.reduce((s, r) => s + (r.bytes || 0), 0),
    failures: failed.map(r => ({ route: r.route, error: r.error })),
    routes_ok: ok.map(r => r.route),
  };
  writeFileSync(join(DIST, 'prerender-report.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n[prerender] Concluído. ok=${ok.length} fail=${failed.length} → dist/prerender-report.json\n`);
}

main().catch(err => {
  console.error('\n[prerender] Falha fatal:', err.message);
  process.exit(1);
});
