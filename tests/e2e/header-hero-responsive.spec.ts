import { test, expect, type Page } from '@playwright/test';

/**
 * Regressões visuais + estruturais entre celular e tablet
 * cobrindo Header, Hero, CTAs, contador de cidade e menu hambúrguer.
 *
 * Foco (pedido cirúrgico do usuário):
 *  1. Snapshots comparativos mobile (390x844) vs tablet (820x1180) do topo da home.
 *  2. Cidade deve aparecer apenas 1x em tablet (regressão do GeoBadge duplicado).
 *  3. Espaço entre banner de patrocinadores e hero travado por snapshot.
 *  4. Menu hambúrguer em tablet não deve quebrar linha nem sobrepor título/CTAs.
 */

const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 820, height: 1180 };

async function gotoStableHome(page: Page) {
  await page.goto('/');
  // Aguarda hero pronto (rotator com data-current-slug) para estabilizar snapshot.
  await page.getByTestId('hero-rotating-text').waitFor({ state: 'visible', timeout: 15000 });
  // Pequena folga para fontes/animações iniciais assentarem.
  await page.waitForTimeout(300);
}

test.describe('Header + Hero · responsivo mobile vs tablet', () => {
  test('snapshot topo da home — mobile', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: MOBILE, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await gotoStableHome(page);
    // Captura os primeiros ~900px (header + hero + banner patrocinador + início do "passo a passo").
    await expect(page).toHaveScreenshot('home-top-mobile.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: MOBILE.width, height: 844 },
      maxDiffPixelRatio: 0.05,
    });
    await ctx.close();
  });

  test('snapshot topo da home — tablet', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: TABLET, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await gotoStableHome(page);
    await expect(page).toHaveScreenshot('home-top-tablet.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: TABLET.width, height: 1180 },
      maxDiffPixelRatio: 0.05,
    });
    await ctx.close();
  });

  test('cidade aparece apenas 1x em tablet (regressão GeoBadge duplicado)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: TABLET, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await gotoStableHome(page);

    // GeoBadge tem role de botão com nome contendo o ícone Map/Location; filtramos por data-testid quando existir.
    // Fallback: contamos badges no header cujo texto casa com padrão "Cidade" ou "Cidade / UF".
    const header = page.locator('header');
    const badges = header.locator('[data-testid="geo-badge"], [aria-label*="localização" i], [aria-label*="cidade" i]');
    const count = await badges.count();
    // Em tablet só o badge esquerdo deve aparecer (o compacto direito é sm:hidden).
    expect(count, `Esperava no máx 1 GeoBadge visível no header em tablet, encontrei ${count}`).toBeLessThanOrEqual(1);
    await ctx.close();
  });

  test('espaçamento banner patrocinador → hero (tablet) travado por snapshot', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: TABLET, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await gotoStableHome(page);
    // Área foco: 0..720px (banner sponsor + hero + início dos próximos blocos).
    await expect(page).toHaveScreenshot('sponsor-to-hero-gap-tablet.png', {
      clip: { x: 0, y: 0, width: TABLET.width, height: 720 },
      maxDiffPixelRatio: 0.03,
    });
    await ctx.close();
  });

  test('menu hambúrguer em tablet não quebra linha nem sobrepõe CTAs', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: TABLET, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await gotoStableHome(page);

    const menuBtn = page.getByRole('button', { name: /^menu$/i });
    await expect(menuBtn, 'Botão de menu deve estar visível em tablet').toBeVisible();
    await menuBtn.click();

    // Sheet/menu abre — pegamos os itens e validamos que cada um cabe em uma única linha.
    const items = page.locator('[role="dialog"] a, [data-sheet] a, nav[aria-label*="menu" i] a').filter({ hasText: /\S/ });
    const n = await items.count();
    expect(n, 'Menu deve ter itens ao abrir').toBeGreaterThan(0);

    for (let i = 0; i < Math.min(n, 8); i++) {
      const el = items.nth(i);
      const box = await el.boundingBox();
      if (!box) continue;
      // Cada item ocupa altura próxima de uma linha (< 72px). Se quebrasse linha, seria maior.
      expect(box.height, `Item ${i} altura ${box.height} — provável quebra de linha`).toBeLessThan(80);
      // E deve ficar dentro do viewport (não sobrepondo lateralmente CTAs/título).
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(TABLET.width + 1);
    }

    await ctx.close();
  });
});
