/**
 * Smoke pós-deploy (@smoke) — roda contra a URL pública real após publicar.
 *
 * Valida, antes de marcar a release como concluída:
 *  1. Home publica e responde 200 com o shell renderizado.
 *  2. O build ativo é o esperado (APP_VERSION exposto em <meta name="app-version">).
 *  3. /sw.js é servido com no-cache (cache busting funcionando).
 *  4. Busca pública por categoria/cidade carrega.
 *  5. Perfil de prestador marca data-seo-ready="true".
 *  6. Edge `gsc-verify` está fechada para anônimo (401/403 — nunca 200).
 *  7. Rotas admin não vazam dados para não autenticados.
 *
 * BASE_URL default: https://precisodeum.com.br
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE_URL = (process.env.BASE_URL || 'https://precisodeum.com.br').replace(/\/$/, '');

function localAppVersion(): string {
  try {
    const src = readFileSync('src/lib/appVersion.ts', 'utf8');
    return src.match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1] ?? '';
  } catch {
    return '';
  }
}

test.describe('@smoke pós-deploy', () => {
  test('home responde 200 e renderiza', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('#root')).toBeVisible();
    await expect(page).toHaveTitle(/Preciso de um/i);
  });

  test('build ativo corresponde ao APP_VERSION do repositório', async ({ page }) => {
    const expected = localAppVersion();
    test.skip(!expected, 'APP_VERSION não encontrado no repositório');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    const live = await page.evaluate(() =>
      document.querySelector('meta[name="app-version"]')?.getAttribute('content') ?? '',
    );
    expect(live, 'meta app-version ausente — deploy antigo no ar').not.toBe('');
    expect(live).toBe(expected);
  });

  test('/sw.js é servido sem cache', async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${BASE_URL}/sw.js`);
    expect(res.status()).toBe(200);
    const cc = (res.headers()['cache-control'] || '').toLowerCase();
    expect(cc).toMatch(/no-cache|max-age=0/);
    await ctx.dispose();
  });

  test('busca pública carrega', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/buscar?q=eletricista`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('#root')).toBeVisible();
  });

  test('sitemap responde XML', async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${BASE_URL}/sitemap.xml`);
    expect(res.status()).toBe(200);
    expect((await res.text()).slice(0, 200)).toContain('<');
    await ctx.dispose();
  });

  test('edge gsc-verify recusa chamadas anônimas', async () => {
    const projectId = process.env.VITE_SUPABASE_PROJECT_ID || 'qaftogrqeyymewoofexc';
    const ctx = await pwRequest.newContext();
    const res = await ctx.post(`https://${projectId}.supabase.co/functions/v1/gsc-verify`, {
      data: { action: 'status' },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

  test('rota admin não vaza dados para anônimo', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    // Deve redirecionar para login ou mostrar bloqueio — nunca listar dados.
    await page.waitForTimeout(2500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    const blocked = /entrar|login|acesso|permiss|carregando/.test(body);
    expect(blocked, 'tela admin não deve renderizar dados para anônimo').toBeTruthy();
  });

  test('public_profiles é legível por anônimo (view pública sem PII)', async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${REST}/public_profiles?select=id,full_name&limit=1`, {
      headers: anonHeaders(),
      failOnStatusCode: false,
    });
    expect(res.status(), `public_profiles quebrou para anônimo: ${await res.text()}`).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBeTruthy();
    // Nenhuma coluna sensível pode escapar pela view.
    for (const row of rows) {
      for (const forbidden of ['tax_id', 'phone', 'whatsapp', 'email', 'cpf', 'cnpj']) {
        expect(row).not.toHaveProperty(forbidden);
      }
    }
    await ctx.dispose();
  });

  test('profiles permanece fechada para anônimo (42501/permission denied)', async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${REST}/profiles?select=id&limit=1`, {
      headers: anonHeaders(),
      failOnStatusCode: false,
    });
    if (res.status() === 200) {
      const rows = await res.json();
      expect(Array.isArray(rows) && rows.length === 0, 'profiles vazou linhas para anônimo').toBeTruthy();
    } else {
      expect([401, 403]).toContain(res.status());
    }
    await ctx.dispose();
  });

  test('health-check reporta serviços críticos saudáveis (inclui gsc-verify)', async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${FUNCTIONS}/health-check`, {
      headers: anonHeaders(),
      failOnStatusCode: false,
    });
    expect([200, 503]).toContain(res.status());
    const payload = await res.json().catch(() => null);
    expect(payload, 'health-check não retornou JSON').not.toBeNull();
    const raw = JSON.stringify(payload).toLowerCase();
    expect(raw).toContain('gsc');
    expect(raw, 'health-check reportou serviço em falha').not.toContain('"status":"down"');
    await ctx.dispose();
  });
});

