/**
 * E2E — Cenários de coordenação multi-aba do /cadastro-inicial.
 *
 * Complementa `cadastro-multitab-stuck.spec.ts` (que trava skeleton) e
 * valida especificamente a lógica de heartbeat + leader election:
 *
 *   1. Uma única aba nunca exibe o aviso "editando em outra aba".
 *   2. F5 (reload) na mesma aba preserva o `tabId` e a liderança.
 *   3. Duas abas simultâneas → apenas a segunda vê o aviso.
 *   4. Expiração de TTL (encerramento abrupto) → aba remanescente promove-se.
 *
 * Estratégia: inspecionamos diretamente `localStorage.wizard_tab_leader`
 * e `sessionStorage.onboarding_v2_tab_id` (contratos internos estáveis) em
 * vez de depender do render do WizardShell, que exige auth. Isso mantém os
 * testes rápidos e independentes de credenciais.
 */
import { test, expect } from '../playwright-fixture';

const LEADER_KEY = 'wizard_tab_leader';
const TAB_ID_KEY = 'onboarding_v2_tab_id';
const HEARTBEAT_KEY = 'onboarding_v2_active_tab';
const WARNING_TEXT = /editando em outra aba/i;

async function readTabState(page: import('@playwright/test').Page) {
  return page.evaluate(
    ([leaderKey, tabIdKey, heartbeatKey]) => ({
      leader: (() => {
        try {
          const raw = localStorage.getItem(leaderKey);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })(),
      heartbeat: (() => {
        try {
          const raw = localStorage.getItem(heartbeatKey);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })(),
      tabId: (() => {
        try {
          return sessionStorage.getItem(tabIdKey);
        } catch {
          return null;
        }
      })(),
    }),
    [LEADER_KEY, TAB_ID_KEY, HEARTBEAT_KEY],
  );
}

test.describe('/cadastro-inicial · coordenação multi-aba', () => {
  test('aba única: nunca exibe aviso e mantém liderança', async ({ page }) => {
    await page.goto('/cadastro-inicial');

    // Espera heartbeat + leader estabilizarem (grace de 2s + 1 tick).
    await expect
      .poll(async () => (await readTabState(page)).leader?.tabId ?? null, {
        timeout: 5000,
        intervals: [200, 400],
      })
      .not.toBeNull();

    const state = await readTabState(page);
    expect(state.tabId).toBeTruthy();
    expect(state.leader?.tabId).toBe(state.tabId);
    expect(state.heartbeat?.tabId).toBe(state.tabId);

    // Aviso NUNCA deve aparecer em janela de 3s.
    const warning = page.getByText(WARNING_TEXT);
    await expect(warning).toHaveCount(0, { timeout: 3000 });
  });

  test('reload (F5) preserva tabId e liderança', async ({ page }) => {
    await page.goto('/cadastro-inicial');
    await expect
      .poll(async () => (await readTabState(page)).leader?.tabId ?? null, { timeout: 5000 })
      .not.toBeNull();
    const before = await readTabState(page);
    expect(before.tabId).toBeTruthy();
    expect(before.leader?.tabId).toBe(before.tabId);

    await page.reload();
    await expect
      .poll(async () => (await readTabState(page)).leader?.tabId ?? null, { timeout: 5000 })
      .not.toBeNull();

    const after = await readTabState(page);
    // sessionStorage sobrevive ao F5 → mesmo tabId.
    expect(after.tabId).toBe(before.tabId);
    // Reassumiu liderança sem esperar TTL.
    expect(after.leader?.tabId).toBe(after.tabId);
    // Sem aviso de concorrência (é a mesma aba, só recarregada).
    await expect(page.getByText(WARNING_TEXT)).toHaveCount(0, { timeout: 3000 });
  });

  test('duas abas: apenas a segunda é bloqueada', async ({ context }) => {
    const tabA = await context.newPage();
    await tabA.goto('/cadastro-inicial');
    await expect
      .poll(async () => (await readTabState(tabA)).leader?.tabId ?? null, { timeout: 5000 })
      .not.toBeNull();
    const stateA = await readTabState(tabA);
    expect(stateA.leader?.tabId).toBe(stateA.tabId);

    // Abre segunda aba enquanto A ainda envia heartbeat fresco.
    const tabB = await context.newPage();
    await tabB.goto('/cadastro-inicial');
    // Aguarda grace period (2s) + primeira avaliação em B.
    await tabB.waitForTimeout(2800);

    const stateB = await readTabState(tabB);
    // Líder no localStorage compartilhado deve continuar sendo A.
    expect(stateB.leader?.tabId).toBe(stateA.tabId);
    expect(stateB.tabId).not.toBe(stateA.tabId);

    // B deve mostrar o aviso; A não.
    await expect(tabB.getByText(WARNING_TEXT).first()).toBeVisible({ timeout: 4000 });
    await expect(tabA.getByText(WARNING_TEXT)).toHaveCount(0);

    await tabA.close();
    await tabB.close();
  });

  test('lock expirado (encerramento abrupto): aba remanescente retoma edição', async ({ page }) => {
    await page.goto('/cadastro-inicial');
    await expect
      .poll(async () => (await readTabState(page)).leader?.tabId ?? null, { timeout: 5000 })
      .not.toBeNull();
    const initial = await readTabState(page);
    const myTabId = initial.tabId!;

    // Simula "encerramento abrupto" de outra aba que era líder: injeta um
    // registro fantasma com timestamp ANTIGO (>6s = LEADER_STALE_MS) e
    // heartbeat também vencido, sem passar pelo cleanup.
    await page.evaluate(
      ([leaderKey, heartbeatKey]) => {
        const ancient = Date.now() - 15_000;
        localStorage.setItem(
          leaderKey,
          JSON.stringify({ tabId: 'ghost-crashed-tab', ts: ancient }),
        );
        localStorage.setItem(
          heartbeatKey,
          JSON.stringify({ tabId: 'ghost-crashed-tab', updatedAt: ancient }),
        );
      },
      [LEADER_KEY, HEARTBEAT_KEY],
    );

    // Espera o heartbeat de liderança (4s) rodar ao menos uma vez e detectar stale.
    // Damos margem para até 2 ciclos (~9s).
    await expect
      .poll(async () => (await readTabState(page)).leader?.tabId ?? null, {
        timeout: 12_000,
        intervals: [500, 1000],
      })
      .toBe(myTabId);

    // Aviso não deve estar visível: sem líder concorrente fresco, esta aba
    // reassumiu e o toast some (ou nunca aparece).
    await expect(page.getByText(WARNING_TEXT)).toHaveCount(0, { timeout: 3000 });
  });

  test('duas abas abertas simultaneamente: apenas UM líder no localStorage compartilhado', async ({
    context,
  }) => {
    // Dispara ambas as navegações em paralelo (Promise.all) para minimizar
    // a defasagem entre boots e forçar a corrida no claim inicial.
    const [tabA, tabB] = await Promise.all([context.newPage(), context.newPage()]);
    await Promise.all([tabA.goto('/cadastro-inicial'), tabB.goto('/cadastro-inicial')]);

    // Aguarda ambos escreverem tabId + heartbeat estabilizar.
    await Promise.all([
      expect
        .poll(async () => (await readTabState(tabA)).tabId, { timeout: 5000 })
        .not.toBeNull(),
      expect
        .poll(async () => (await readTabState(tabB)).tabId, { timeout: 5000 })
        .not.toBeNull(),
    ]);

    const [stateA, stateB] = await Promise.all([readTabState(tabA), readTabState(tabB)]);
    // Cada aba tem tabId próprio (sessionStorage é isolado por aba).
    expect(stateA.tabId).not.toBe(stateB.tabId);
    // localStorage é compartilhado → líder registrado é o MESMO valor
    // observado por ambas as abas, e é o tabId de uma delas (não ambos).
    expect(stateA.leader?.tabId).toBe(stateB.leader?.tabId);
    expect([stateA.tabId, stateB.tabId]).toContain(stateA.leader?.tabId);

    await tabA.close();
    await tabB.close();
  });

  test('navegação entre telas preserva liderança e tabId da aba', async ({ page }) => {
    await page.goto('/cadastro-inicial');
    await expect
      .poll(async () => (await readTabState(page)).leader?.tabId ?? null, { timeout: 5000 })
      .not.toBeNull();
    const before = await readTabState(page);
    expect(before.leader?.tabId).toBe(before.tabId);

    // Sai da rota do wizard (cleanup do effect libera a chave), depois
    // volta. sessionStorage.tabId sobrevive; leader é reassumido.
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.goto('/cadastro-inicial');
    await expect
      .poll(async () => (await readTabState(page)).leader?.tabId ?? null, { timeout: 5000 })
      .not.toBeNull();

    const after = await readTabState(page);
    expect(after.tabId).toBe(before.tabId);
    expect(after.leader?.tabId).toBe(after.tabId);
    await expect(page.getByText(WARNING_TEXT)).toHaveCount(0, { timeout: 3000 });
  });
});
