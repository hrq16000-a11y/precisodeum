/**
 * E2E (estático) do fluxo unificado — Fusão Estrutural Fase B.
 *
 * Garante que:
 *  - Legados V1, /cadastro-bet, /onboarding-v2 e suas pastas/páginas
 *    foram REMOVIDOS de vez. Nada deve voltar a importar esses caminhos.
 *  - /cadastro-inicial é a porta ÚNICA do onboarding.
 *  - O handoff Triagem → Criação de Serviço é interno ao WizardShell
 *    (sem trocar de URL e sem `?source=bet-first-service`).
 *  - Locks "Já preenchido" continuam funcionando.
 *  - PhaseCelebration sugere instalar o app via InstallAppCard.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const exists = (p: string) => fs.existsSync(p);

describe('Onboarding — fluxo unificado (Fase B)', () => {
  it('legados V1 e shells antigos foram removidos do código-fonte', () => {
    expect(exists('src/components/onboarding/SmartOnboardingWizard.tsx')).toBe(false);
    expect(exists('src/components/onboarding/profileWizard')).toBe(false);
    expect(exists('src/components/onboarding/betMode')).toBe(false);
    expect(exists('src/components/onboarding/onboardingV2')).toBe(false);
    expect(exists('src/pages/TriagePage.tsx')).toBe(false);
    expect(exists('src/pages/TriagePreviewPage.tsx')).toBe(false);
    expect(exists('src/pages/AdminOnboardingPage.tsx')).toBe(false);
    expect(exists('src/pages/CadastroBetPage.tsx')).toBe(false);
    expect(exists('src/pages/OnboardingV2Page.tsx')).toBe(false);
    expect(exists('src/hooks/useOnboardingV2Flag.ts')).toBe(false);
    expect(exists('src/hooks/useWizardAutoSave.ts')).toBe(false);
    expect(exists('src/hooks/useWizardCompleteness.ts')).toBe(false);
  });

  it('Nova estrutura wizard/ está montada (steps + engine)', () => {
    expect(exists('src/components/onboarding/wizard/WizardShell.tsx')).toBe(true);
    expect(exists('src/components/onboarding/wizard/InstallAppCard.tsx')).toBe(true);
    expect(exists('src/components/onboarding/wizard/phases/bet/BetModeShell.tsx')).toBe(true);
    expect(exists('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx')).toBe(true);
    expect(exists('src/components/onboarding/wizard/phases/v2/state.ts')).toBe(true);
    expect(exists('src/components/onboarding/wizard/phases/v2/bootstrap.ts')).toBe(true);
    expect(exists('src/pages/CadastroInicialPage.tsx')).toBe(true);
  });

  it('App.tsx só conhece /cadastro-inicial como rota ativa de onboarding', () => {
    const app = read('src/App.tsx');
    expect(app).not.toMatch(/element=\{<TriagePage/);
    expect(app).not.toMatch(/element=\{<CadastroBetPage/);
    expect(app).not.toMatch(/element=\{<OnboardingV2Page/);
    // Gate aceita apenas /cadastro-inicial e /onboarding-v2/sucesso (página de sucesso pós-fluxo).
    expect(app).toContain("location.pathname === '/cadastro-inicial'");
    expect(app).not.toContain("location.pathname === '/cadastro-bet'");
    expect(app).not.toContain("location.pathname === '/onboarding-v2'\n");
    // Gate redireciona para /cadastro-inicial.
    expect(app).toContain('to="/cadastro-inicial"');
    expect(app).toContain('path="/cadastro-inicial"');
    // Rotas legadas viram redirect para a porta única.
    expect(app).toMatch(/path="\/cadastro-bet"\s+element=\{<Navigate to="\/cadastro-inicial"/);
    expect(app).toMatch(/path="\/onboarding-v2"\s+element=\{<Navigate to="\/cadastro-inicial"/);
    expect(app).toMatch(/path="\/triagem"\s+element=\{<Navigate to="\/cadastro-inicial"/);
  });

  it('WizardShell unifica triagem + criação de serviço sem trocar de URL', () => {
    const shell = read('src/components/onboarding/wizard/WizardShell.tsx');
    expect(shell).toContain('BetModeShell');
    expect(shell).toContain('OnboardingV2Shell');
    expect(shell).toContain('onInternalHandoff');
    expect(shell).toContain('internalHandoffFromTriage');
  });

  it('PhaseCelebration sugere instalar o app via InstallAppCard', () => {
    const phase3 = read('src/components/onboarding/wizard/phases/v2/Phase3Celebration.tsx');
    expect(phase3).toContain('InstallAppCard');
    expect(phase3).toContain('wizard-phase3-celebration');
  });

  it('LoginPage e OAuth handler levam o usuário para /cadastro-inicial', () => {
    const login = read('src/pages/LoginPage.tsx');
    const oauth = read('src/components/OAuthRedirectHandler.tsx');
    expect(login).toContain("navigate('/cadastro-inicial'");
    expect(login).toContain("emailRedirectTo: `${window.location.origin}/cadastro-inicial`");
    expect(oauth).toContain("navigate('/cadastro-inicial'");
  });

  it('BetModeShell não navega mais para /onboarding-v2 (handoff é interno)', () => {
    const bet = read('src/components/onboarding/wizard/phases/bet/BetModeShell.tsx');
    expect(bet).not.toContain('source=bet-first-service');
    expect(bet).not.toMatch(/navigate\(['"]\/onboarding-v2/);
    expect(bet).not.toMatch(/navigate\(['"]\/triagem/);
    expect(bet).toContain('onInternalHandoff');
  });

  it('OnboardingV2Shell não lê mais ?source — usa prop interna', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(shell).not.toContain("searchParams.get('source')");
    expect(shell).not.toContain('bet-first-service');
    expect(shell).toContain('internalHandoffFromTriage');
    expect(shell).toContain('resolveOnboardingV2SeedState');
    expect(shell).toContain('onboarding-v2-phase-regression-blocked');
    expect(shell).toContain('Já preenchido:');
  });

  it('Pular 1º serviço mantém o usuário dentro do wizard', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(shell).toContain("source: 'onboarding-v2-skip-first-service'");
    expect(shell).toContain("nextRoute: 'phase4_document'");
    expect(shell).not.toContain("navigate('/dashboard/servicos')");
  });

  it('Persistência do 1º serviço usa exclusivamente create_service_atomic', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    const services = read('src/pages/DashboardServicesPage.tsx');
    expect(shell).toContain('create_service_atomic');
    expect(services).toContain('create_service_atomic');
    expect(shell).not.toMatch(/\.from\(['"]services['"]\)\s*\.insert/);
    expect(services).not.toMatch(/\.from\(['"]services['"]\)\s*\.insert/);
  });

  it('Profissional finaliza marcando onboarding_completed=true mesmo sem serviço', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(shell).toMatch(/onboarding_step:\s*5,\s*onboarding_completed:\s*true/);
  });

  it('Sidebar admin não anuncia mais /admin/onboarding (V1)', () => {
    const nav = read('src/components/admin/AdminGroupNav.tsx');
    expect(nav).not.toContain("path: '/admin/onboarding'");
  });
});
