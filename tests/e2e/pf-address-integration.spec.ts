/**
 * Teste de integração — PF address roundtrip via supabase-js.
 *
 * Fluxo:
 *  1. Faz UPDATE em providers (street/street_number/show_full_address) usando
 *     supabase-js com sessão do E2E_USER (RLS aplica naturalmente).
 *  2. Abre /profissional/{slug} e valida que o HTML reflete o estado.
 *  3. Reverte (cleanup) ao fim do teste.
 *
 * Graceful skip quando faltam:
 *   - E2E_USER_EMAIL / E2E_USER_PASSWORD
 *   - E2E_PF_PROFILE_SLUG (slug do próprio usuário, dono do provider)
 *   - VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos do build).
 */
import { test, expect, type Page } from '../../playwright-fixture';

const SLUG = process.env.E2E_PF_PROFILE_SLUG || '';
const EMAIL = process.env.E2E_USER_EMAIL || '';
const PASSWORD = process.env.E2E_USER_PASSWORD || '';

type AddressFixture = {
  street: string;
  street_number: string;
  show_full_address: boolean;
};

async function applyProviderAddress(page: Page, fix: AddressFixture) {
  // Executa dentro do contexto da página para reusar o supabase-js já carregado.
  return page.evaluate(async (payload) => {
    // Busca o client do bundle: a app expõe via singleton em window quando
    // disponível; senão importa dinamicamente do módulo do app.
    // @ts-expect-error — runtime injection
    const sb = (window as unknown as { __supabase?: unknown }).__supabase;
    if (!sb) {
      const mod = await import('/src/integrations/supabase/client.ts');
      // @ts-expect-error — module import
      return mod.supabase
        .from('providers')
        .update({
          street: payload.street,
          street_number: payload.street_number,
          show_full_address: payload.show_full_address,
        })
        .eq('user_id', (await mod.supabase.auth.getUser()).data.user?.id || '')
        .select('street, street_number, show_full_address')
        .single();
    }
    // @ts-expect-error — runtime client
    const { data: ures } = await sb.auth.getUser();
    // @ts-expect-error — runtime client
    return sb
      .from('providers')
      .update({
        street: payload.street,
        street_number: payload.street_number,
        show_full_address: payload.show_full_address,
      })
      .eq('user_id', ures.user?.id)
      .select('street, street_number, show_full_address')
      .single();
  }, fix);
}

test.describe('PF address — integração supabase-js + render público', () => {
  test.skip(!SLUG || !EMAIL || !PASSWORD, 'Defina E2E_PF_PROFILE_SLUG, E2E_USER_EMAIL e E2E_USER_PASSWORD.');

  test('show_full_address=true → rua/número aparecem no HTML; reverter para false esconde', async ({ page }) => {
    // Abre o app autenticado (assume sessão persistida; se não, skipa).
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    if (page.url().match(/\/(login|auth)/)) {
      test.skip(true, 'Sessão E2E não inicializada — login fora do escopo.');
    }

    // 1) Aplica show_full_address=true com endereço sintético rastreável.
    const stamp = `Rua Teste E2E ${Date.now().toString(36).slice(-5)}`;
    const num = '1234';
    const upd = await applyProviderAddress(page, {
      street: stamp,
      street_number: num,
      show_full_address: true,
    });
    expect(upd, 'UPDATE supabase-js retornou null — RLS provavelmente bloqueou').toBeTruthy();

    // 2) Vai ao perfil público e confirma renderização + flag.
    await page.goto(`/profissional/${SLUG}`);
    await page.waitForLoadState('networkidle');

    const flag = await page
      .locator('[data-show-full-address]')
      .first()
      .getAttribute('data-show-full-address')
      .catch(() => null);
    expect(flag).toBe('true');

    const html = await page.content();
    expect(html).toContain(stamp);
    expect(html).toContain(num);

    // Botões de contato continuam funcionais.
    const contactCta = page
      .getByRole('button', { name: /WhatsApp|Solicitar contato|Falar agora|Conversar/i })
      .or(page.getByRole('link', { name: /WhatsApp|Solicitar contato/i }));
    await expect(contactCta.first()).toBeVisible();

    // 3) Reverte para show_full_address=false e valida que vaza zero.
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await applyProviderAddress(page, {
      street: stamp,
      street_number: num,
      show_full_address: false,
    });

    await page.goto(`/profissional/${SLUG}`);
    await page.waitForLoadState('networkidle');

    const html2 = await page.content();
    expect(html2).not.toContain(stamp);
    expect(html2).not.toContain(`, ${num}`);

    const flag2 = await page
      .locator('[data-show-full-address]')
      .first()
      .getAttribute('data-show-full-address')
      .catch(() => null);
    if (flag2 !== null) expect(flag2).toBe('false');
  });
});
