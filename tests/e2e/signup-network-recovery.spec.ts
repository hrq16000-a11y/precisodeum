/**
 * E2E — Perda e recuperação de conexão durante o signup.
 *
 * Simula dois cenários de resiliência:
 *   1. Rede offline no momento do submit → a UI mostra mensagem de erro
 *      (não fica travada em spinner) e o botão volta a ser clicável.
 *   2. Depois que a rede volta, o mesmo submit conclui com sucesso e o
 *      usuário chega ao dashboard/onboarding.
 *
 * Usamos `context.setOffline` (nível de Playwright) porque ele afeta TODAS
 * as requisições do browser, incluindo fetch para o Supabase. Isso reproduz
 * de forma determinística uma queda real de rede.
 *
 * Cleanup: o e-mail criado é removido via `cleanup-e2e-test-users` no
 * `afterAll`.
 */
import { test, expect } from '../../playwright-fixture';
import {
  cleanupE2eUsers,
  registerE2eEmail,
  strongPassword,
  uniqueE2eEmail,
} from './helpers/e2e-cleanup';

test.describe('Signup — perda e recuperação de rede', () => {
  test.skip(process.env.SKIP_SIGNUP_E2E === '1', 'Signup E2E desativado');

  test.afterAll(async () => {
    await cleanupE2eUsers();
  });

  test('offline no submit mostra erro e recupera quando volta online', async ({ page, context }) => {
    const email = uniqueE2eEmail();
    const password = strongPassword();
    registerE2eEmail(email);

    await page.goto('/cadastro', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/e-?mail/i).first().fill(email);
    await page.getByLabel(/^senha$/i).first().fill(password);

    // -------- 1. Corta a rede antes do submit
    await context.setOffline(true);
    const submit = page.getByRole('button', { name: /^continuar$/i });
    await submit.click();

    // A UI deve reagir: ou toast/mensagem de erro OU botão volta a estar
    // habilitado dentro de um tempo razoável (nada de spinner infinito).
    const errorMessage = page.getByText(
      /(verifique sua conexão|erro inesperado|tente novamente|não foi possível|offline|falha)/i,
    );
    await expect
      .poll(
        async () => {
          const disabled = await submit.getAttribute('disabled');
          const errVisible = await errorMessage.first().isVisible().catch(() => false);
          return disabled === null || errVisible;
        },
        { timeout: 20_000, message: 'UI deveria sair do estado de loading ao ficar offline' },
      )
      .toBe(true);

    // Não navegou para nenhuma tela autenticada.
    expect(page.url()).toMatch(/\/(cadastro|entrar|login)/);

    // -------- 2. Rede volta → novo submit deve concluir com sucesso
    await context.setOffline(false);

    // Garante que os campos ainda estão preenchidos (não perdemos o estado).
    const emailValue = await page.getByLabel(/e-?mail/i).first().inputValue();
    if (emailValue !== email) {
      await page.getByLabel(/e-?mail/i).first().fill(email);
      await page.getByLabel(/^senha$/i).first().fill(password);
    }

    await page.getByRole('button', { name: /^continuar$/i }).click();
    await page.waitForURL(
      (u) =>
        u.pathname.startsWith('/dashboard') ||
        u.pathname.startsWith('/cadastro-inicial') ||
        u.pathname.startsWith('/onboarding-v2') ||
        u.pathname === '/triagem',
      { timeout: 30_000 },
    );
  });
});
