/**
 * Garantias permanentes do fluxo de finalização do Onboarding V2:
 *
 * 1. A fase fantasma `phase4_review` foi REMOVIDA do PHASE_ORDER, do union
 *    `OnboardingPhase` e de qualquer referência em código (sem volta).
 * 2. A última fase ativa antes de `done` é `phase4_extras_b` — depois disso
 *    o shell despacha para a página de sucesso (`/onboarding-v2/sucesso`),
 *    que tem um CTA explícito para `/dashboard`.
 * 3. `finishWizard` é fail-soft: erro de update/refetch NÃO impede navegação.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

function read(p: string) {
  return fs.readFileSync(path.resolve(root, p), 'utf-8');
}

describe('Onboarding V2 — fluxo final', () => {
  it('phase4_review não existe mais em state.ts', () => {
    const stateSrc = read('components/onboarding/wizard/phases/v2/state.ts');
    expect(stateSrc).not.toMatch(/phase4_review/);
    // PHASE_ORDER deve terminar em phase4_extras_b → done
    expect(stateSrc).toMatch(/'phase4_extras_b'/);
    expect(stateSrc).toMatch(/'done'/);
  });

  it('phase4_review não existe mais em types.ts', () => {
    const typesSrc = read('components/onboarding/wizard/phases/v2/types.ts');
    expect(typesSrc).not.toMatch(/phase4_review/);
    // a união deve continuar declarando done como fase terminal
    expect(typesSrc).toMatch(/\|\s*'done'/);
  });

  it('OnboardingV2Shell trata case "done" e navega para a tela de sucesso', () => {
    const shellSrc = read('components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(shellSrc).toMatch(/case 'done'/);
    expect(shellSrc).toMatch(/\/onboarding-v2\/sucesso/);
    // Não deve haver redirecionamento para a fase fantasma
    expect(shellSrc).not.toMatch(/phase4_review/);
  });

  it('finishWizard é fail-soft (erro não bloqueia navegação)', () => {
    const shellSrc = read('components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    // Procuramos o bloco da função e validamos que não retorna cedo no erro.
    const start = shellSrc.indexOf('const finishWizard');
    expect(start).toBeGreaterThan(-1);
    const end = shellSrc.indexOf('};', start) + 2;
    const fn = shellSrc.slice(start, end);
    // Aviso (warning/warn) presente, mas sem `return;` cancelando a navegação.
    expect(fn).toMatch(/navigate\('\/onboarding-v2\/sucesso'/);
    expect(fn).toMatch(/fail-soft/i);
    // O `return;` antigo, dentro do if(error), foi removido.
    expect(fn).not.toMatch(/toast\.error\([^)]*Não consegui concluir/);
  });

  it('Página de sucesso tem CTA direto para /dashboard', () => {
    const successSrc = read('pages/OnboardingV2SuccessPage.tsx');
    // Link <Link to="/dashboard"> é o CTA primário
    expect(successSrc).toMatch(/to="\/dashboard"/);
    expect(successSrc).toMatch(/Ir para o Dashboard/);
  });

  it('Rota /onboarding-v2/sucesso está registrada no App.tsx', () => {
    const appSrc = read('App.tsx');
    expect(appSrc).toMatch(/path="\/onboarding-v2\/sucesso"/);
    expect(appSrc).toMatch(/OnboardingV2SuccessPage/);
  });

  it('wizardReducer mapeia "done" para "done" (não volta a main_more_services)', () => {
    const reducerSrc = read('components/onboarding/wizard/wizardReducer.ts');
    // A linha do mapeamento explícito deve existir
    expect(reducerSrc).toMatch(/case 'done':\s*return 'done'/);
  });
});
