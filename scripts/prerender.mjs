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
const CONCURRENCY = 4;
const TIMEOUT = 25_000;
const READY_SELECTOR = '#root > *';

async function renderRoute(browser, baseUrl, route) {
  const page = await browser.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,woff,woff2}', r => r.abort());

  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: TIMEOUT });
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
    await page.close();
  }
}

async function main() {
  const server = await preview({
    preview: { port: PORT, strictPort: true, open: false },
  });
  const baseUrl = `http://localhost:${PORT}`;
  const routes = await generatePrerenderRoutes();

  console.log(`\n[prerender] Iniciando: ${routes.length} rotas | concorrência: ${CONCURRENCY}\n`);

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  let done = 0;
  for (let i = 0; i < routes.length; i += CONCURRENCY) {
    const batch = routes.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(r => renderRoute(browser, baseUrl, r)));
    done += batch.length;
    console.log(`  [${done}/${routes.length}]`);
  }

  await browser.close();
  server.httpServer.close();
  console.log(`\n[prerender] Concluído. ${routes.length} arquivos HTML em dist/\n`);
}

main().catch(err => {
  console.error('\n[prerender] Falha fatal:', err.message);
  process.exit(1);
});
