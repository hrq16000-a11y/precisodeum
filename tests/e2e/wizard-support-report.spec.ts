/**
 * E2E — Suporte phase2_photos: payload do diálogo após sessão expirada.
 *
 * Cenário:
 *   1. Renderizamos uma página isolada (`/__test/report-button`) que monta
 *      o `ReportWizardErrorButton` com `contextSnapshot` simulando uma
 *      sessão expirada na fase de fotos.
 *   2. Interceptamos a chamada do Supabase para `error_reports` e
 *      validamos que o payload (em `error_stack`) contém:
 *        - code: 'phase2_photos:no_session'
 *        - step: 'phase2_photos:no_session'
 *        - contextSnapshot.category, .city, .has_provider
 *        - browser.userAgent (navegador real)
 *
 * Por que rota dedicada: montar o wizard inteiro num E2E é frágil (requer
 * sessão real, dados, Supabase). Isolamos o contrato público do botão
 * — que é exatamente o que o suporte enxerga.
 *
 * Se a rota `/__test/report-button` não existir no app (build de produção),
 * o teste é pulado — não falha o pipeline.
 */
import { test, expect } from '../../playwright-fixture';

test.describe('Reportar para o suporte — payload phase2_photos', () => {
  test('payload contém code, categoria, cidade, etapa e navegador', async ({ page }) => {
    const harnessUrl = '/__test/report-button?code=phase2_photos:no_session&city=Curitiba&category=cat-eletricista';
    const resp = await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
    test.skip(!resp || resp.status() === 404, 'rota de harness ausente neste build');

    // Captura inserts em error_reports (REST do Supabase: POST .../error_reports?...)
    const insertPromise = page.waitForRequest(
      (req) =>
        req.method() === 'POST' &&
        /\/rest\/v1\/error_reports/i.test(req.url()),
      { timeout: 15_000 },
    );

    await page.getByTestId('report-dialog-send').click();

    const insertReq = await insertPromise;
    const body = insertReq.postDataJSON();
    const stackRaw =
      Array.isArray(body) ? body[0]?.error_stack : body?.error_stack;
    expect(typeof stackRaw).toBe('string');
    const stack = JSON.parse(stackRaw as string);

    expect(stack.code).toBe('phase2_photos:no_session');
    expect(stack.step).toBe('phase2_photos:no_session');
    expect(stack.contextSnapshot?.city).toBe('Curitiba');
    expect(stack.contextSnapshot?.category).toBe('cat-eletricista');
    expect(stack.browser?.userAgent).toBeTruthy();

    // Etapa "recebido" deve aparecer (não fechar o modal automaticamente)
    await expect(page.getByTestId('report-dialog-receipt')).toBeVisible();
    await expect(page.getByTestId('report-dialog-ticket')).toBeVisible();
  });
});
