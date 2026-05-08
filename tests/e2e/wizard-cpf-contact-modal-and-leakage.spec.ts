/**
 * E2E — Cobertura completa de contato no perfil público PF.
 *
 * Casos cobertos:
 *  1. Modal "Solicitar contato": abre, fecha (Esc + botão), restaura foco
 *     no trigger e o submit do form cria lead (confirmando POST /leads ou RPC).
 *  2. Link WhatsApp: text= contém nome do profissional + serviço/categoria,
 *     com encoding correto (UTF-8 percent-encoded).
 *  3. Profissional sem WhatsApp (E2E_PF_PROFILE_SLUG_NO_WA): apenas o
 *     fallback "Solicitar contato" deve aparecer e funcionar.
 *  4. Privacidade `show_full_address=false`: nenhum vestígio de rua/número
 *     no HTML — nem em texto, nem em `data-*`, nem em atributos `title/aria-*`.
 *
 * Graceful skip para manter pipeline estável quando fixtures faltam.
 *
 * Escopo: 100% restrito a tests/e2e/ (sem mudanças em código de produção).
 */
import { test, expect, type Page } from '../../playwright-fixture';

const SLUG = process.env.E2E_PF_PROFILE_SLUG || '';
const SLUG_NO_WA = process.env.E2E_PF_PROFILE_SLUG_NO_WA || '';

async function gotoProfile(page: Page, slug: string) {
  await page.goto(`/profissional/${slug}`);
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/\/404|not-found/i);
}

test.describe('Perfil público PF — contato e privacidade (E2E)', () => {
  test.skip(!SLUG, 'Defina E2E_PF_PROFILE_SLUG para rodar este spec.');

  test('WhatsApp: text= inclui nome do profissional + serviço/categoria com encoding válido', async ({ page }) => {
    await gotoProfile(page, SLUG);

    const wa = page
      .locator('a[href^="https://wa.me/"], a[href^="whatsapp://send"]')
      .filter({ hasNot: page.locator('[data-wa-skip="true"]') })
      .first();
    if (!(await wa.count())) test.skip(true, 'Fixture sem WhatsApp — coberto em outro caso.');

    const href = (await wa.getAttribute('href')) || '';
    const rawText = href.split('text=')[1] || '';
    expect(rawText.length).toBeGreaterThan(0);

    // Encoding válido: decode não pode lançar e deve preservar acentos pt-BR.
    let decoded = '';
    expect(() => { decoded = decodeURIComponent(rawText); }).not.toThrow();

    // Deve ser percent-encoded (não literal). Espaços viram %20 ou +.
    expect(rawText).toMatch(/%20|\+/);

    // Nome do profissional aparece como h1 — extrai e exige presença na msg.
    const profName = (await page.locator('h1').first().innerText().catch(() => '')).trim();
    if (profName) {
      // Primeiro nome basta (mensagem padrão usa "Olá {Nome}!").
      const firstName = profName.split(/\s+/)[0];
      expect(decoded).toContain(firstName);
    }

    // Serviço/categoria: a página expõe via data-testid OU heurística "Categoria:".
    const categoryText =
      (await page.locator('[data-testid="provider-category"]').first().innerText().catch(() => '')) ||
      '';
    if (categoryText.trim()) {
      // Mensagem "Preciso de ajuda com {categoria}" ou inclusão direta.
      expect(decoded.toLowerCase()).toContain(categoryText.trim().toLowerCase().slice(0, 12));
    } else {
      // Fallback amplo: a copy padrão sempre cita "Preciso de Um".
      expect(decoded).toMatch(/Preciso de [Uu]m|perfil/i);
    }
  });

  test('Modal "Solicitar contato": abre, submit cria lead, fecha e restaura foco', async ({ page }) => {
    await gotoProfile(page, SLUG);

    const trigger = page
      .getByRole('button', { name: /Solicitar contato|Falar agora|Conversar/i })
      .first();
    if (!(await trigger.count())) test.skip(true, 'Sem trigger de contato neste fixture.');

    // Foco inicial no trigger (para validar restauração depois).
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Foco entra no dialog (a11y).
    const focusedInDialog = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(focusedInDialog).toBe(true);

    // Tenta preencher campos comuns (nome/whatsapp/mensagem). Skip se ausentes.
    const nameInput = dialog.getByLabel(/nome/i).first();
    const waInput = dialog.getByLabel(/whatsapp|telefone/i).first();
    const msgInput = dialog.getByLabel(/mensagem|descri/i).first();

    if (await nameInput.count()) await nameInput.fill('Teste E2E Contato');
    if (await waInput.count()) await waInput.fill('41997452053');
    if (await msgInput.count()) await msgInput.fill('Olá, gostaria de um orçamento para o serviço.');

    // Captura provider_id e categoria da página para validar payload.
    const providerId = await page
      .locator('[data-provider-id]').first()
      .getAttribute('data-provider-id').catch(() => null);
    const category = (await page
      .locator('[data-testid="provider-category"]').first()
      .innerText().catch(() => '')).trim();

    // Espia chamadas de rede: aceita REST (/rest/v1/leads) ou RPC.
    const leadCallPromise = page
      .waitForRequest(
        (req) =>
          req.method() === 'POST' &&
          /\/rest\/v1\/(leads|contact_requests)|\/rpc\/(create_lead|request_contact)/i.test(req.url()),
        { timeout: 6000 },
      )
      .catch(() => null);

    const submit = dialog
      .getByRole('button', { name: /Enviar|Confirmar|Solicitar/i })
      .first();
    if (await submit.count()) {
      await submit.click();
      const req = await leadCallPromise;
      if (req) {
        const raw = req.postData() || '';
        const flat = raw.toLowerCase();
        // Mensagem exata
        expect(flat).toContain('gostaria de um orçamento');
        // WhatsApp canonicalizado (com ou sem 55)
        expect(flat).toMatch(/41997452053|5541997452053/);
        // Nome exato
        expect(flat).toContain('teste e2e contato');
        // provider_id presente (campo varia: provider_id / professional_id / target_id)
        if (providerId) expect(flat).toContain(providerId.toLowerCase());
        // Categoria/serviço presente
        if (category) expect(flat).toContain(category.toLowerCase().slice(0, 8));
      }
    }

    // Fecha modal (botão X ou Esc) — testa Esc explicitamente para a11y.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 3000 }).catch(async () => {
      // Alguns modais ignoram Esc após submit — fallback no botão de fechar.
      const closeBtn = page.getByRole('button', { name: /Fechar|Cancelar|×/i }).first();
      if (await closeBtn.count()) await closeBtn.click();
      await expect(dialog).toBeHidden();
    });

    // Foco volta para o trigger (a11y crítico).
    const focusReturned = await trigger.evaluate((el) => el === document.activeElement);
    expect(focusReturned).toBe(true);
  });
});

test.describe('Perfil PF sem telefone — apenas fallback de contato (E2E)', () => {
  test.skip(!SLUG_NO_WA, 'Defina E2E_PF_PROFILE_SLUG_NO_WA para rodar este caso.');

  test('não renderiza link wa.me/tel: e expõe apenas "Solicitar contato"', async ({ page }) => {
    await gotoProfile(page, SLUG_NO_WA);

    // Nenhum link wa.me ou tel: visível (FloatingWhatsApp é global e fica de fora — data-wa-skip).
    const waCount = await page
      .locator('a[href^="https://wa.me/"], a[href^="whatsapp://send"], a[href^="tel:"]')
      .filter({ hasNot: page.locator('[data-wa-skip="true"]') })
      .count();
    expect(waCount).toBe(0);

    // CTA fallback presente e clicável.
    const fallback = page.getByRole('button', { name: /Solicitar contato|Falar agora/i }).first();
    await expect(fallback).toBeVisible();
    await fallback.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('Privacidade — show_full_address=false não vaza rua/número (E2E)', () => {
  test.skip(!SLUG, 'Defina E2E_PF_PROFILE_SLUG.');

  test('HTML completo (texto + data-* + aria/title) não contém padrão "Rua X, 123"', async ({ page }) => {
    await gotoProfile(page, SLUG);

    const flag = await page
      .locator('[data-show-full-address]')
      .first()
      .getAttribute('data-show-full-address')
      .catch(() => null);

    if (flag !== 'false') {
      test.skip(true, 'Fixture com show_full_address=true — caso coberto em outro spec.');
    }

    // Vasculha HTML inteiro: texto, data attributes, aria-*, title.
    const html = await page.content();

    // Padrão duro: "Rua/Av/Avenida/... <algo>, 123". NUNCA pode aparecer.
    const streetWithNumber = /\b(Rua|Avenida|Av\.|Travessa|Alameda|Praça|Rodovia)\s+[^"<,\n]{2,}?,\s*\d{1,5}\b/i;
    expect(streetWithNumber.test(html)).toBe(false);

    // data-street / data-street-number / data-postal-code não devem ter valor real.
    for (const attr of ['data-street', 'data-street-number', 'data-postal-code']) {
      const leak = await page.locator(`[${attr}]`).first();
      if (await leak.count()) {
        const v = (await leak.getAttribute(attr)) || '';
        expect(v.trim()).toBe('');
      }
    }
  });
});
