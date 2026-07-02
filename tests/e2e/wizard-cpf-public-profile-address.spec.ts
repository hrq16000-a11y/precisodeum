/**
 * E2E — PF conclui cadastro e perfil público respeita show_full_address.
 *
 * Cenários:
 *  A) show_full_address = true   → perfil mostra rua + número.
 *  B) show_full_address = false  → perfil mostra apenas bairro/cidade,
 *     e NUNCA renderiza rua/número crus.
 *
 * Em ambos: botões de contato (WhatsApp / Solicitar contato) devem estar
 * presentes e funcionais (href válido com tel/wa.me ou trigger de modal).
 *
 * Estratégia:
 *  - Graceful skip quando faltam credenciais E2E (mantém o pipeline verde).
 *  - Quando E2E_PF_PROFILE_SLUG está setado, abre direto o perfil público e
 *    valida apenas a renderização (cenário "estado real" — o cadastro foi
 *    feito previamente). Quando E2E_USER_EMAIL/PASSWORD estão presentes mas
 *    o slug não, marca como skip — concluir o wizard inteiro requer fixtures
 *    fora do escopo deste spec (cobertos em outros).
 *  - Os asserts são *condicionais ao DOM* observado: se o teste detecta
 *    `data-show-full-address="true"`, exige rua/número; senão, exige ausência.
 *
 * Escopo: 100% restrito a tests/e2e/ (sem mudanças em código de produção).
 */
import { test, expect } from '../../playwright-fixture';

const SLUG = process.env.E2E_PF_PROFILE_SLUG || '';
const HAS_CREDS = !!process.env.E2E_USER_EMAIL && !!process.env.E2E_USER_PASSWORD;

test.describe('Perfil público PF — show_full_address (E2E)', () => {
  test.skip(!SLUG && !HAS_CREDS, 'Defina E2E_PF_PROFILE_SLUG ou E2E_USER_EMAIL/PASSWORD.');

  test('renderiza endereço completo OU apenas bairro/cidade conforme flag, com botões de contato', async ({ page }) => {
    if (!SLUG) {
      test.skip(true, 'Sem slug PF de fixture — cadastro completo via wizard fora do escopo deste spec.');
    }

    await page.goto(`/profissional/${SLUG}`);
    await page.waitForLoadState('networkidle');

    // Página deve carregar (não 404).
    await expect(page).not.toHaveURL(/\/404|not-found/i);

    // Detecta a flag exposta no DOM (data-show-full-address) ou heurística textual.
    const flagAttr = await page
      .locator('[data-show-full-address]')
      .first()
      .getAttribute('data-show-full-address')
      .catch(() => null);

    const showFull = flagAttr === 'true';

    // Localiza container de localização (heurística ampla — funciona com vários layouts).
    const locationBlock = page.locator('[data-testid="provider-location"], section:has-text("Localização"), main');

    if (showFull) {
      // Quando a flag é true: deve aparecer rua + número (heurística por padrão "Rua/Av/... , 123").
      await expect(locationBlock.first()).toContainText(/\b(Rua|Av\.?|Avenida|Travessa|Alameda|Praça|Rodovia)\b/i);
      await expect(locationBlock.first()).toContainText(/\d+/);
    } else {
      // Quando a flag é false: NÃO deve haver "Rua X, 123" — apenas cidade/bairro.
      const text = (await locationBlock.first().innerText().catch(() => '')) || '';
      const leakedStreet = /\b(Rua|Avenida|Av\.)\s+[^,\n]{2,}?,\s*\d+/i.test(text);
      expect(leakedStreet).toBe(false);
    }

    // ===== Botões de contato — asserts de href/ação =====
    //
    // 1) Link de WhatsApp: deve apontar para wa.me/{55DDDNUMBER} ou whatsapp://send?phone=…
    //    com um text= codificado (mensagem). FloatingWhatsApp é ignorado (data-wa-skip).
    const waLink = page
      .locator('a[href^="https://wa.me/"], a[href^="whatsapp://send"]')
      .filter({ hasNot: page.locator('[data-wa-skip="true"]') })
      .first();

    const hasWa = await waLink.count();
    if (hasWa > 0) {
      await expect(waLink).toBeVisible();
      const href = (await waLink.getAttribute('href')) || '';
      // Canonical: 55 + DDD (2) + número (8 ou 9) = 12 ou 13 dígitos.
      expect(href).toMatch(/^(https:\/\/wa\.me\/|whatsapp:\/\/send\?phone=)55\d{10,11}/);
      // Mensagem deve estar URL-encoded.
      expect(href).toContain('text=');
      expect(decodeURIComponent(href.split('text=')[1] || '')).toMatch(/Preciso de [Uu]m|perfil|conversar/i);
      // Link externo seguro.
      expect(await waLink.getAttribute('target')).toBe('_blank');
      expect(await waLink.getAttribute('rel') || '').toMatch(/noopener/);
    }

    // 2) Link tel: (se exposto) deve usar formato canônico tel:55DDDNUMBER.
    const telLink = page.locator('a[href^="tel:"]').first();
    if (await telLink.count()) {
      const tel = (await telLink.getAttribute('href')) || '';
      expect(tel).toMatch(/^tel:\+?55?\d{10,13}$/);
    }

    // 3) Botão "Solicitar contato" (fallback quando não há WhatsApp público) —
    //    deve ser clicável e abrir um modal/dialog (role=dialog) ou navegar.
    const solicitar = page
      .getByRole('button', { name: /Solicitar contato|Falar agora|Conversar/i })
      .first();

    if (await solicitar.count()) {
      await expect(solicitar).toBeEnabled();
      await solicitar.click();
      // Espera por modal OU mudança de URL (qualquer ação observável).
      const dialog = page.getByRole('dialog');
      const opened = await Promise.race([
        dialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false),
        page.waitForURL(/contato|whatsapp|lead/i, { timeout: 3000 }).then(() => true).catch(() => false),
      ]);
      expect(opened).toBe(true);
    } else {
      // Se não há "Solicitar contato", o WhatsApp deve estar presente — caso contrário falha.
      expect(hasWa).toBeGreaterThan(0);
    }
  });
});
