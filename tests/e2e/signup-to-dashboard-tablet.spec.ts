/**
 * E2E — Signup completo (tablet 820x1180) → Dashboard.
 *
 * Objetivo:
 *   Provar que, no viewport tablet retrato (820x1180), um novo usuário
 *   consegue criar conta pela `/cadastro` (LoginPage cria conta automática
 *   quando o e-mail é novo) e chegar ao `/dashboard` (ou `/cadastro-inicial`
 *   como próxima etapa legítima do onboarding) sem:
 *     - erros de RLS (401/403/42501) em qualquer request Supabase,
 *     - erros JS não tratados (page.on('pageerror')),
 *     - erros de trigger de banco (ex.: "record 'new' has no field ...").
 *
 * Estratégia:
 *   - Gera e-mail único a cada run (`e2e+<ts>-<rand>@precisodeum.test`).
 *   - Preenche formulário de /cadastro, submete e espera navegação para
 *     `/dashboard` ou `/cadastro-inicial` (ambos são destinos válidos:
 *     usuários novos entram no wizard antes de virem para o dashboard).
 *   - Instala RLS spy sobre `/rest/v1/` e `/auth/v1/token?grant_type=signup`.
 *   - Pula com graceful skip quando `SKIP_SIGNUP_E2E=1` (útil quando o
 *     projeto Supabase do preview desabilita signups anônimos temporariamente).
 *
 * Escopo: 100% restrito a `tests/e2e/` — nenhum código de app é tocado.
 */
import { test, expect, type Page, type Response } from '../../playwright-fixture';

const TABLET_VIEWPORT = { width: 820, height: 1180 } as const;

const SUPABASE_REST = /\/rest\/v1\//;
const SUPABASE_AUTH_SIGNUP = /\/auth\/v1\/signup/;

interface RlsViolation {
  url: string;
  status: number;
  method: string;
  body?: string;
}

function installRlsSpy(page: Page): RlsViolation[] {
  const violations: RlsViolation[] = [];
  page.on('response', async (resp: Response) => {
    const url = resp.url();
    const status = resp.status();
    if (!SUPABASE_REST.test(url) && !SUPABASE_AUTH_SIGNUP.test(url)) return;
    // Signup pode retornar 400 em duplicidade de e-mail; nosso e-mail é único.
    if (status === 401 || status === 403 || status === 500 || status === 502) {
      let body: string | undefined;
      try { body = (await resp.text()).slice(0, 500); } catch { /* noop */ }
      violations.push({ url, status, method: resp.request().method(), body });
      return;
    }
    if (status >= 400 && SUPABASE_REST.test(url)) {
      let body: string | undefined;
      try { body = (await resp.text()).slice(0, 500); } catch { /* noop */ }
      if (body && /42501|violates row-level security|permission denied|has no field/i.test(body)) {
        violations.push({ url, status, method: resp.request().method(), body });
      }
    }
  });
  return violations;
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    // Ignora erros ruidosos e não críticos vindos de extensões/ambiente.
    const msg = err.message ?? String(err);
    if (/ResizeObserver|Non-Error promise rejection|ChunkLoadError/i.test(msg)) return;
    errors.push(msg);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/has no field|42501|row-level security/i.test(text)) {
      errors.push(`[console.error] ${text}`);
    }
  });
  return errors;
}

function uniqueEmail(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e+${ts}-${rand}@precisodeum.test`;
}

test.describe('Signup completo — viewport tablet 820x1180', () => {
  test.skip(
    process.env.SKIP_SIGNUP_E2E === '1',
    'Signup E2E desativado via SKIP_SIGNUP_E2E=1',
  );

  test.use({ viewport: TABLET_VIEWPORT });

  test('novo e-mail cria conta e chega a /dashboard ou /cadastro-inicial sem 42501', async ({ page }) => {
    const violations = installRlsSpy(page);
    const pageErrors = collectPageErrors(page);

    const email = uniqueEmail();
    // Senha atende às regras do HIBP-gated do projeto (12+ chars, mista).
    const password = `E2eTest!${Date.now().toString(36)}Aa1`;

    await page.goto('/cadastro', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel(/e-?mail/i).first()).toBeVisible({ timeout: 10_000 });

    await page.getByLabel(/e-?mail/i).first().fill(email);
    // O PasswordInput é um input type="password" (ou "text" quando revelado)
    // — buscamos por label "Senha" que é único no form.
    await page.getByLabel(/^senha$/i).first().fill(password);

    // O botão do form ativo diz "Continuar"; usamos exact match para não
    // colidir com "Continuar sem GPS" ou textos similares em outras telas.
    await page.getByRole('button', { name: /^continuar$/i }).click();

    // Sucesso = navegou para dashboard OU para o wizard de onboarding.
    // Aceitamos ambos porque o gate de novo usuário pode redirecionar para
    // /cadastro-inicial antes de liberar o /dashboard.
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith('/dashboard') ||
        url.pathname.startsWith('/cadastro-inicial') ||
        url.pathname.startsWith('/onboarding-v2') ||
        url.pathname === '/triagem',
      { timeout: 30_000 },
    );

    // Se caiu no dashboard direto, valida que a página não está em branco.
    if (page.url().includes('/dashboard')) {
      await expect(page.locator('main, [role="main"], header')).toBeVisible({ timeout: 10_000 });
    } else {
      // Caso wizard: valida que renderizou algum passo interativo.
      await expect(page.locator('form, [data-testid], button')).toBeVisible({ timeout: 10_000 });
    }

    // Asserts finais de saúde do fluxo:
    expect.soft(violations, `RLS/PostgREST violations: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
    expect.soft(pageErrors, `Erros JS críticos: ${pageErrors.join('\n')}`).toEqual([]);
  });
});
