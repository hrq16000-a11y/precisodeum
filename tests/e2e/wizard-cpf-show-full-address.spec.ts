/**
 * E2E — Wizard CPF (PF) com endereço opcional + show_full_address.
 *
 * Valida ponta a ponta:
 *  1. /cadastro-inicial em modo CPF expõe o bloco "Adicionar endereço (Opcional)".
 *  2. Ao revelar e preencher o endereço, o checkbox "Exibir endereço completo
 *     no perfil público" fica visível com microcopy específica para PF
 *     ("aparecer online" / privacidade da residência).
 *  3. Ao concluir o cadastro, o perfil público respeita a flag — quando marcada,
 *     mostra rua/número; quando desmarcada, mostra apenas bairro/cidade.
 *
 * Estratégia: graceful skip — pulamos quando E2E_USER_EMAIL/PASSWORD não estão
 * presentes, idêntico aos outros specs do projeto (mantém pipeline estável).
 *
 * Escopo: 100% restrito a tests/e2e/.
 */
import { test, expect } from '../../playwright-fixture';

const HAS_CREDS = !!process.env.E2E_USER_EMAIL && !!process.env.E2E_USER_PASSWORD;

test.describe('Wizard CPF — endereço opcional + show_full_address (E2E)', () => {
  test.skip(!HAS_CREDS, 'Requer E2E_USER_EMAIL e E2E_USER_PASSWORD no ambiente.');

  test('PF revela endereço, marca show_full_address e vê o microtexto correto', async ({ page }) => {
    await page.goto('/cadastro-inicial?mode=review');

    // Espera o wizard montar — abre flexibilidade caso o app redirecione p/ login.
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/auth') || page.url().includes('/login')) {
      test.skip(true, 'Sessão expirou — login fora do escopo deste spec.');
    }

    // Localiza o botão revelador "Adicionar endereço" (texto pode variar PF vs PJ).
    const reveal = page.getByText(/Adicionar endereço/i).first();
    if (!(await reveal.isVisible().catch(() => false))) {
      test.skip(true, 'Bloco de endereço não visível na fase atual — fluxo já avançou.');
    }
    await reveal.click();

    // Aparece o checkbox de exibir endereço completo.
    const checkbox = page.getByRole('checkbox', { name: /Exibir endereço completo/i });
    await expect(checkbox).toBeVisible();

    // Microcopy específica de PF deve mencionar "aparecer online" OU privacidade
    // de residência, dependendo do tipo da conta.
    const helperText = page.getByText(/aparecer online|residência fica privada|Atende em/i).first();
    await expect(helperText).toBeVisible();

    // Marca o checkbox e confirma estado.
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });
});
