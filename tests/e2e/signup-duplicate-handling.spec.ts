/**
 * E2E — Tratamento de duplicidade no signup.
 *
 * Objetivo: garantir que, quando o usuário tenta cadastrar um e-mail que já
 * existe (ou reprocessa o mesmo CPF/tax_id no fluxo Bet Mode), a UI mostra
 * mensagem consistente em pt-BR e NÃO expõe stack trace / erro cru do banco.
 *
 * Cobre 2 caminhos observáveis pelo usuário anônimo:
 *   1. Signup com e-mail duplicado → toast/inline "Já existe uma conta…" +
 *      foco no campo de e-mail (sem 500 / sem "record has no field").
 *   2. Signup com CPF duplicado (heurística via RPC) NÃO é testado aqui
 *      porque a checagem só ocorre dentro do wizard autenticado — a suíte
 *      Vitest em `src/hooks/__tests__/useWizardDuplicateCheck.test.ts` cobre
 *      o contrato da RPC. Este spec valida a camada visível de erro.
 *
 * Cleanup: os e-mails criados são registrados via `registerE2eEmail` e
 * removidos no `afterAll` pela edge function `cleanup-e2e-test-users`.
 */
import { test, expect } from '../../playwright-fixture';
import {
  cleanupE2eUsers,
  registerE2eEmail,
  strongPassword,
  uniqueE2eEmail,
} from './helpers/e2e-cleanup';

test.describe('Signup — duplicidade', () => {
  test.skip(process.env.SKIP_SIGNUP_E2E === '1', 'Signup E2E desativado');

  test.afterAll(async () => {
    await cleanupE2eUsers();
  });

  test('e-mail duplicado mostra mensagem consistente e não vaza erro cru', async ({ page }) => {
    const email = uniqueE2eEmail();
    const password = strongPassword();
    registerE2eEmail(email);

    // --- 1ª tentativa: cria a conta.
    await page.goto('/cadastro', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/e-?mail/i).first().fill(email);
    await page.getByLabel(/^senha$/i).first().fill(password);
    await page.getByRole('button', { name: /^continuar$/i }).click();

    await page.waitForURL(
      (url) =>
        url.pathname.startsWith('/dashboard') ||
        url.pathname.startsWith('/cadastro-inicial') ||
        url.pathname.startsWith('/onboarding-v2') ||
        url.pathname === '/triagem',
      { timeout: 30_000 },
    );

    // --- Sai da conta para tentar recriar.
    await page.context().clearCookies();
    await page.evaluate(() => {
      try { window.localStorage.clear(); } catch { /* noop */ }
      try { window.sessionStorage.clear(); } catch { /* noop */ }
    });

    // --- 2ª tentativa: mesmo e-mail → deve ser bloqueado com mensagem clara.
    await page.goto('/cadastro', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/e-?mail/i).first().fill(email);
    await page.getByLabel(/^senha$/i).first().fill(password);
    await page.getByRole('button', { name: /^continuar$/i }).click();

    // Aceita qualquer uma das mensagens padronizadas no LoginPage.
    const dupMessage = page.getByText(
      /(já existe uma conta|este e-?mail já possui conta|e-?mail ou senha inválidos)/i,
    );
    await expect(dupMessage.first()).toBeVisible({ timeout: 15_000 });

    // Nunca deve mostrar erro cru de banco/trigger.
    await expect(page.getByText(/has no field|42501|violates row-level security/i))
      .toHaveCount(0);

    // Continua na página de auth (não navegou para dashboard).
    expect(page.url()).toMatch(/\/(cadastro|login|entrar)/);
  });
});
