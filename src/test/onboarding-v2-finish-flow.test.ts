/**
 * Garantias permanentes do fluxo de finalização do Onboarding V2:
 *
 * 1. A fase fantasma `phase4_review` foi REMOVIDA do PHASE_ORDER, do union
 *    `OnboardingPhase` e de qualquer referência em código (sem volta).
 * 2. A última fase ativa antes de `done` é `phase4_extras_b` — depois disso
 *    o shell despacha para a página de sucesso (`/onboarding-v2/sucesso`),
 *    que tem um CTA explícito para `/dashboard`.
 * 3. `finishWizard` é fail-LOUD por contrato: se `finalizeOnboarding` retorna
 *    !ok, o shell mostra toast.error com retry e NÃO navega para /sucesso.
 *    Motivo: navegar com perfil não marcado como completo gera loop no
 *    OnboardingGate (Gate → /sucesso → /dashboard → Gate → /cadastro-inicial).
 *    Atomicidade real vem da RPC `finalize_onboarding_atomic`; o front
 *    apenas respeita o resultado da transação. Refetch de UI é não-bloqueante.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resolveOnboardingGateTarget } from '@/lib/onboardingAccess';

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

  it('finishWizard é fail-LOUD: bloqueia navegação quando finalizeOnboarding retorna !ok', () => {
    const shellSrc = read('components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    const start = shellSrc.indexOf('const finishWizard');
    expect(start).toBeGreaterThan(-1);
    const end = shellSrc.indexOf('};', start) + 2;
    const fn = shellSrc.slice(start, end);
    // Caminho feliz: navega para /sucesso quando result.ok.
    expect(fn).toMatch(/navigate\('\/onboarding-v2\/sucesso'/);
    // Contrato fail-loud: `if (!result.ok)` aborta antes da navegação.
    expect(fn).toMatch(/if\s*\(!result\.ok\)/);
    expect(fn).toMatch(/return;/);
    // Toast com retry — sem isso o usuário fica preso sem reação possível.
    expect(fn).toMatch(/toast\.error\([^)]*Não foi possível concluir/);
    expect(fn).toMatch(/Tentar novamente/);
    // Refetch de profile permanece não-bloqueante (try/catch + warn).
    expect(fn).toMatch(/refetchProfile/);
    expect(fn).toMatch(/non-blocking/i);
  });

  it('Página de sucesso tem CTA direto para /dashboard', () => {
    const successSrc = read('pages/OnboardingV2SuccessPage.tsx');
    // Link <Link to="/dashboard"> é o CTA primário
    expect(successSrc).toMatch(/to="\/dashboard"/);
    expect(successSrc).toMatch(/Ir para o Dashboard/);
  });

  it('Rota /onboarding-v2/sucesso está registrada no router (App.tsx ou src/routes/*)', async () => {
    // PR 3 split: rotas foram movidas para src/routes/*. Agregamos todas as
    // fontes de roteamento para evitar falso negativo.
    const { readRouterSources } = await import('./helpers/routerSources');
    const routerSrc: string = readRouterSources();
    expect(routerSrc).toMatch(/path="\/onboarding-v2\/sucesso"/);
    expect(routerSrc).toMatch(/OnboardingV2SuccessPage/);
  });

  it('wizardReducer mapeia "done" para "done" (não volta a main_more_services)', () => {
    const reducerSrc = read('components/onboarding/wizard/wizardReducer.ts');
    // A linha do mapeamento explícito deve existir
    expect(reducerSrc).toMatch(/case 'done':\s*return 'done'/);
  });

  it('WizardShell só mostra a tela "Tudo pronto" depois de passar por portfólio e finalizar o onboarding', () => {
    const shellSrc = read('components/onboarding/wizard/WizardShell.tsx');
    expect(shellSrc).toContain("phase: 'main_portfolio_albums'");
    expect(shellSrc).toContain('Step21_PortfolioAlbums');
    expect(shellSrc).toContain('finalizeUnifiedOnboarding');
    // O patch literal `onboarding_step: 5, onboarding_completed: true` é
    // aplicado pela RPC `finalize_onboarding_atomic`. O shell unificado só
    // injeta `profile_type: 'provider'` como complemento.
    expect(shellSrc).toMatch(/finalizeOnboarding\(\{[\s\S]*?extraProfilePatch:\s*\{\s*profile_type:\s*'provider'\s*\}/);
  });

  it('finalização do V2 força profile_type=provider ao concluir', () => {
    const shellSrc = read('components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    // Idem: a finalização canônica passa por `finalizeOnboarding` com
    // `extraProfilePatch.profile_type = 'provider'`.
    expect(shellSrc).toMatch(/finalizeOnboarding\(\{[\s\S]*?extraProfilePatch:\s*\{\s*profile_type:\s*'provider'\s*\}/);
  });


  it('WizardShell aceita prop mode (WizardMode) com alias deprecated reviewMode', () => {
    const shellSrc = read('components/onboarding/wizard/WizardShell.tsx');
    // Novo contrato: prop `mode` + alias deprecated `reviewMode`
    expect(shellSrc).toContain('mode?: WizardMode');
    expect(shellSrc).toContain('reviewMode?: boolean');
    expect(shellSrc).toContain('resolveWizardMode');
    // Hidratação usa o booleano interno `isReview` derivado do modo
    expect(shellSrc).toMatch(/phase: isReview\s*\?\s*resolveReviewStartPhase/);
    // CadastroInicialPage propaga mode='edit_profile' quando reviewMode=true
    const pageSrc = read('pages/CadastroInicialPage.tsx');
    expect(pageSrc).toContain("mode={reviewMode ? 'edit_profile' : 'new_signup'}");
  });

  it('EditModeSkipButton está desativado (no-op) por solicitação do usuário', () => {
    // O botão global "Pular esta etapa" foi removido em todo o Wizard/Assistente.
    // O componente é mantido como no-op para preservar imports legados.
    const btnSrc = read('components/onboarding/wizard/EditModeSkipButton.tsx');
    expect(btnSrc).toMatch(/return null/);
    expect(btnSrc).toMatch(/DESATIVADO|no-op/i);
    // O listener do evento foi extraído para `useWizardSkipListener`. O shell
    // V2 ainda é o único consumidor desse hook (caso futuras phases voltem a
    // emitir o evento).
    const v2Src = read('components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(v2Src).toContain('useWizardSkipListener');
    const listenerSrc = read('hooks/onboarding/useWizardSkipListener.ts');
    expect(listenerSrc).toContain("'wizard:request-skip'");
  });


  it('rotas protegidas do onboarding não retornam para /cadastro-inicial após /onboarding-v2/sucesso', () => {
    const profile = { profile_type: 'provider', onboarding_completed: false, onboarding_step: 4 };

    const successDecision = resolveOnboardingGateTarget({
      profile,
      pathname: '/onboarding-v2/sucesso',
      search: '',
    });
    expect(successDecision.action).toBe('allow');

    const dashboardDecision = resolveOnboardingGateTarget({
      profile,
      pathname: '/dashboard',
      search: '',
      completionGraceActive: true,
    });
    expect(dashboardDecision.action).toBe('allow');

    const dashboardLeadDecision = resolveOnboardingGateTarget({
      profile,
      pathname: '/dashboard/leads',
      search: '',
      completionGraceActive: true,
    });
    expect(dashboardLeadDecision.action).toBe('allow');
  });
});
