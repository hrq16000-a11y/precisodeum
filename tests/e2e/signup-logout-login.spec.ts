/**
 * E2E — Signup → Logout → Login em mobile, tablet e desktop.
 *
 * Garante que o ciclo completo funciona em qualquer viewport crítico do
 * projeto: após criar a conta, o usuário consegue sair e voltar a entrar
 * com a mesma senha, sem estados travados nem 401 residual.
 *
 * Cleanup: todos os e-mails criados são removidos via
 * `cleanup-e2e-test-users` no `afterAll`.
 */
import { test, expect, type Page } from '../../playwright-fixture';
import {
  cleanupE2eUsers,
  registerE2eEmail,
  strongPassword,
  uniqueE2eEmail,
} from './helpers/e2e-cleanup';

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844  },
  { name: 'tablet',  width: 820,  height: 1180 },
  { name: 'desktop', width: 1440, height: 900  },
] as const;

async function signOutFromApp(page: Page) {
  // Estratégia resiliente: 1) limpa storage no client (equivalente ao efeito
  // do supabase.auth.signOut para nosso storageKey) e 2) reforça com cookies.
  await page.evaluate(() => {
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch { /* noop */ }
    try { window.sessionStorage.clear(); } catch { /* noop */ }
  });
  await page.context().clearCookies();
}

test.describe('Signup → logout → login (multi-viewport)', () => {
  test.skip(process.env.SKIP_SIGNUP_E2E === '1', 'Signup E2E desativado');

  test.afterAll(async () => {
    await cleanupE2eUsers();
  });

  for (const vp of VIEWPORTS) {
    test(`ciclo completo em ${vp.name} ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const email = uniqueE2eEmail();
      const password = strongPassword();
      registerE2eEmail(email);

      // ---- Signup
      await page.goto('/cadastro', { waitUntil: 'domcontentloaded' });
      await page.getByLabel(/e-?mail/i).first().fill(email);
      await page.getByLabel(/^senha$/i).first().fill(password);
      await page.getByRole('button', { name: /^continuar$/i }).click();
      await page.waitForURL(
        (u) =>
          u.pathname.startsWith('/dashboard') ||
          u.pathname.startsWith('/cadastro-inicial') ||
          u.pathname.startsWith('/onboarding-v2') ||
          u.pathname === '/triagem',
        { timeout: 30_000 },
      );

      // ---- Logout
      await signOutFromApp(page);

      // ---- Volta para /entrar e loga com a mesma senha
      await page.goto('/entrar', { waitUntil: 'domcontentloaded' });
      await page.getByLabel(/e-?mail/i).first().fill(email);
      await page.getByLabel(/^senha$/i).first().fill(password);
      await page.getByRole('button', { name: /^(entrar|continuar)$/i }).click();

      await page.waitForURL(
        (u) =>
          u.pathname.startsWith('/dashboard') ||
          u.pathname.startsWith('/cadastro-inicial') ||
          u.pathname.startsWith('/onboarding-v2') ||
          u.pathname === '/triagem',
        { timeout: 30_000 },
      );

      // Sanidade visual: renderizou alguma interface autenticada.
      await expect(page.locator('main, [role="main"], header, form')).toBeVisible({
        timeout: 10_000,
      });
    });
  }
});
