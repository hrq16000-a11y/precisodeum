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
const TIMEOUT = 15_000;
const READY_SELECTOR = '#root > *';

async function renderRoute(browser, baseUrl, route) {
  const page = await browser.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,woff,woff2}', r => r.abort());
  // Bloquear WebSockets (Supabase Realtime) — sem isso 'networkidle' nunca
  // dispararia e o prerender travaria indefinidamente.
  await page.route('wss://**', r => r.abort());
  await page.route('ws://**', r => r.abort());

  try {
    // 'domcontentloaded' + waitForSelector('#root > *') é suficiente para
    // capturar o HTML hidratado sem depender de network idle (impossível em SPA).
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForSelector(READY_SELECTOR, { timeout: TIMEOUT });
    const html = await page.content();

    const filePath = route === '/'
      ? join(DIST, 'index.html')
      : join(DIST, route.replace(/^\//, ''), 'index.html');

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, html, 'utf-8');
    process.stdout.write(`  ✓ ${route}\n`);
  } catch (err) {
    process.stdout.write(`  ✗ ${route}: ${err.message}\n`);
  } finally {
    await page.close().catch(() => {});
  }
}

async function renderRouteWithTimeout(browser, baseUrl, route) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`hard-timeout após ${TIMEOUT + 2000}ms`)), TIMEOUT + 2_000)
  );
  return Promise.race([
    renderRoute(browser, baseUrl, route),
    timeoutPromise,
  ]).catch(err => {
    process.stdout.write(`  ✗ ${route}: ${err.message}\n`);
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

  let done = 0;
  for (let i = 0; i < routes.length; i += CONCURRENCY) {
    const batch = routes.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(r => renderRouteWithTimeout(browser, baseUrl, r)));
    done += batch.length;
    process.stdout.write(`  [${done}/${routes.length}] concluídos\n`);
  }

  await browser.close();
  server.httpServer.close();
  console.log(`\n[prerender] Concluído. ${routes.length} arquivos HTML em dist/\n`);
}

main().catch(err => {
  console.error('\n[prerender] Falha fatal:', err.message);
  process.exit(1);
});
