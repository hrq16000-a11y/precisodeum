import { test, expect, Page } from '@playwright/test';

/**
 * Portfolio · Drag-and-drop E2E
 *
 * Cobre:
 *  1. Reordena duas fotos via teclado (KeyboardSensor do @dnd-kit:
 *     Space para "agarrar", ArrowRight para mover, Space para soltar).
 *  2. Confirma que o PATCH em portfolio_photos disparou (display_order).
 *  3. Recarrega a página e valida que a nova ordem persistiu, ou seja,
 *     a primeira foto (capa do álbum) é a que foi movida para o topo.
 *
 * Requer credenciais reais com pelo menos um álbum com 2+ fotos:
 *  - E2E_USER_EMAIL
 *  - E2E_USER_PASSWORD
 *  - E2E_PORTFOLIO_ALBUM_URL (opcional) — URL direta de /dashboard/portfolio?album=ID
 *    Se ausente, navegamos para /dashboard/portfolio e abrimos o primeiro álbum.
 */

async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto('/login');
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10_000 });
  await emailInput.fill(email);
  await passInput.fill(password);
  await page.locator('button[type="submit"]').first().click();
  await expect.poll(() => page.url(), { timeout: 15_000 }).not.toMatch(/\/login(\b|\?)/);
}

async function readOrderedIds(page: Page): Promise<string[]> {
  return page.$$eval(
    '[data-testid="portfolio-photo-grid"] [data-testid="portfolio-photo-tile"]',
    (nodes) => nodes.map((n) => (n as HTMLElement).dataset.photoId || ''),
  );
}

test.describe('Portfólio · drag-and-drop persiste a ordem', () => {
  test.setTimeout(90_000);

  test('arrasta foto para o topo, salva e mantém após reload', async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    test.skip(
      !email || !password,
      'E2E_USER_EMAIL/E2E_USER_PASSWORD não definidos — pulando teste de portfólio.',
    );

    // Spy de PATCH em portfolio_photos (valida que persistPhotoOrder rodou)
    let portfolioPatchCount = 0;
    page.on('request', (req) => {
      if (
        req.method() === 'PATCH' &&
        /\/rest\/v1\/portfolio_photos\b/.test(req.url())
      ) {
        portfolioPatchCount += 1;
      }
    });

    await loginWithCredentials(page, email!, password!);

    // 1) Vai pro portfólio.
    const directUrl = process.env.E2E_PORTFOLIO_ALBUM_URL;
    await page.goto(directUrl || '/dashboard/portfolio');

    // Caso seja a listagem, abre o primeiro álbum.
    if (!directUrl) {
      const firstAlbum = page
        .locator('a[href*="/dashboard/portfolio"], button')
        .filter({ hasText: /abrir|ver fotos|gerenciar/i })
        .first();
      if (await firstAlbum.count()) {
        await firstAlbum.click().catch(() => {});
      }
    }

    // 2) Aguarda o grid hidratar com pelo menos 2 fotos.
    const grid = page.getByTestId('portfolio-photo-grid');
    await expect(grid).toBeVisible({ timeout: 20_000 });

    const initial = await readOrderedIds(page);
    test.skip(
      initial.length < 2,
      'Álbum precisa ter ≥2 fotos para validar reordenação. Crie fixtures e tente novamente.',
    );

    // 3) Foca a alça de drag da SEGUNDA foto e usa o KeyboardSensor.
    const secondHandle = page
      .locator(`[data-testid="portfolio-drag-handle"][data-photo-id="${initial[1]}"]`)
      .first();
    await secondHandle.focus();

    // Space ativa o pickup do dnd-kit
    await page.keyboard.press('Space');
    // ArrowLeft move uma posição para a esquerda (= subir 1 no grid)
    await page.keyboard.press('ArrowLeft');
    // Space dropa
    await page.keyboard.press('Space');

    // 4) Espera a nova ordem aparecer no DOM e o PATCH ser disparado.
    await expect
      .poll(async () => (await readOrderedIds(page))[0], { timeout: 5_000 })
      .toBe(initial[1]);

    await expect.poll(() => portfolioPatchCount, { timeout: 5_000 }).toBeGreaterThan(0);

    const afterDrag = await readOrderedIds(page);
    expect(afterDrag[0]).toBe(initial[1]);
    expect(afterDrag[1]).toBe(initial[0]);

    // 5) Reload — confirma que display_order foi persistido no banco.
    await page.reload();
    await expect(grid).toBeVisible({ timeout: 20_000 });

    const afterReload = await readOrderedIds(page);
    expect(afterReload.length).toBeGreaterThanOrEqual(2);
    expect(afterReload[0]).toBe(initial[1]); // capa = foto que foi arrastada
    expect(afterReload[1]).toBe(initial[0]);
  });
});
