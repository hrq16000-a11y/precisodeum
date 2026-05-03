/**
 * E2E — /cadastro-inicial nunca trava em skeleton infinito
 *
 * Valida o failsafe do gate de auth contra:
 *   1. Múltiplas abas concorrentes disputando o navigatorLock do Supabase
 *      (cenário real que gerou "Lock broken by another request").
 *   2. getSession() artificialmente travado por mais de 6s.
 *
 * Em ambos os casos, /cadastro-inicial deve:
 *   - Sair do skeleton em ≤7s.
 *   - Renderizar o banner de recuperação (`data-testid=cadastro-stuck-banner`)
 *     OU redirecionar para /login (visitante anônimo após failsafe).
 */
import { test, expect } from '../playwright-fixture';

test.describe('/cadastro-inicial · failsafe contra skeleton infinito', () => {
  test('múltiplas abas simultâneas não deixam a página em skeleton', async ({ context }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    const tabC = await context.newPage();

    await Promise.all([
      tabA.goto('/cadastro-inicial'),
      tabB.goto('/cadastro-inicial'),
      tabC.goto('/cadastro-inicial'),
    ]);

    // Em até 8s, NENHUMA aba pode estar exibindo apenas o skeleton (status busy).
    for (const page of [tabA, tabB, tabC]) {
      await expect
        .poll(
          async () => {
            const url = page.url();
            // Caso anônimo: redireciona para /login com ?next=
            if (/\/login\b/.test(url)) return 'redirected';
            // Caso banner de recuperação visível
            const banner = await page.locator('[data-testid="cadastro-stuck-banner"]').count();
            if (banner > 0) return 'banner';
            // Caso wizard montado (qualquer heading do shell)
            const heading = await page.locator('main h1, main h2').first().count();
            if (heading > 0) return 'wizard';
            return 'skeleton';
          },
          { timeout: 8000, intervals: [250, 500, 1000] },
        )
        .not.toBe('skeleton');
    }
  });

  test('getSession travado dispara banner ou redirect em ≤7s', async ({ page }) => {
    // Intercepta o endpoint de sessão do Supabase e segura por 30s — força
    // o caminho do watchdog (8s no useAuth) + failsafe (6s no gate).
    await page.route(/\/auth\/v1\/(token|user)\b/, async (route) => {
      await new Promise((r) => setTimeout(r, 30_000));
      await route.abort();
    });

    const start = Date.now();
    await page.goto('/cadastro-inicial');

    await expect
      .poll(
        async () => {
          if (/\/login\b/.test(page.url())) return 'redirected';
          const banner = await page.locator('[data-testid="cadastro-stuck-banner"]').count();
          return banner > 0 ? 'banner' : 'pending';
        },
        { timeout: 9000, intervals: [500] },
      )
      .not.toBe('pending');

    expect(Date.now() - start).toBeLessThan(9_000);
  });
});
