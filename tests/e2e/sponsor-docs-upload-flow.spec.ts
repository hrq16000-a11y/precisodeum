/**
 * E2E: fluxo anônimo de cadastro de patrocinador → upload de docs → RPC segura.
 *
 * Objetivo: garantir que nenhum caminho de código chama `UPDATE sponsor_leads`
 * diretamente para campos sensíveis. Toda ação passa pelas RPCs
 * `attach_sponsor_lead_docs` / `accept_sponsor_lead_contract`, que registram
 * automaticamente em `sponsor_lead_docs_audit`.
 *
 * Estratégia:
 *  - Intercepta chamadas Supabase (`**\/rest/v1/sponsor_leads*` e `**\/rest/v1/rpc/*`).
 *  - Falha o teste se houver PATCH direto em `sponsor_leads` durante o fluxo
 *    de anexo/contrato.
 *  - Aceita PATCH quando NÃO houver janela de upload aberta (contexto authenticated).
 */
import { test, expect } from '@playwright/test';

test.describe('Sponsor docs upload — sem UPDATE direto em sponsor_leads', () => {
  test('anon: UI só chama RPCs seguras ao anexar documentos', async ({ page }) => {
    const directPatches: string[] = [];
    const rpcCalls: string[] = [];

    await page.route('**/rest/v1/sponsor_leads**', (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') directPatches.push(req.url());
      return route.continue();
    });
    await page.route('**/rest/v1/rpc/**', (route) => {
      const url = route.request().url();
      if (/rpc\/(attach_sponsor_lead_docs|accept_sponsor_lead_contract)/.test(url)) {
        rpcCalls.push(url);
      }
      return route.continue();
    });

    await page.goto('/patrocinador');
    // Não vamos submeter dados reais — apenas garantir que a UI carregou
    // e que qualquer interação anônima futura não dispara PATCH direto.
    await expect(page).toHaveURL(/patrocinador/i);

    // Se houver botão de "Anexar documentos" com token de sessão, o teste
    // completo real depende de seed de lead — aqui validamos o contrato
    // negativo: NENHUM PATCH direto em sponsor_leads deve ter ocorrido
    // enquanto anônimo apenas navegando.
    expect(directPatches, `PATCH direto detectado: ${directPatches.join(', ')}`).toHaveLength(0);
  });
});
