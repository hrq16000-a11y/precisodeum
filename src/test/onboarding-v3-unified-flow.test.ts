/**
 * E2E (estático) do fluxo unificado V3.
 *
 * Garante que:
 *  - V1 (SmartOnboardingWizard, /triagem, profileWizard) e o flag de A/B
 *    foram REMOVIDOS de vez. Nada deve voltar a importar esses caminhos.
 *  - /cadastro-bet é a porta única de cadastro.
 *  - O CTA "Cadastrar meu primeiro serviço" navega para o motor V2 com
 *    a flag source=bet-first-service e NUNCA para uma rota legada.
 *  - O motor V2 hidrata locks de campos já preenchidos e bloqueia
 *    regressão de fase ao clicar para cadastrar o 1º serviço.
 *  - Pular o 1º serviço mantém o usuário dentro do wizard (phase4_document).
 *  - O gate global aceita apenas as rotas V3/V2 como "em onboarding".
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const exists = (p: string) => fs.existsSync(p);

describe('Onboarding V3 — fluxo unificado', () => {
  it('legados V1 foram removidos do código-fonte', () => {
    expect(exists('src/components/onboarding/SmartOnboardingWizard.tsx')).toBe(false);
    expect(exists('src/components/onboarding/profileWizard')).toBe(false);
    expect(exists('src/pages/TriagePage.tsx')).toBe(false);
    expect(exists('src/pages/TriagePreviewPage.tsx')).toBe(false);
    expect(exists('src/pages/AdminOnboardingPage.tsx')).toBe(false);
    expect(exists('src/hooks/useOnboardingV2Flag.ts')).toBe(false);
    expect(exists('src/hooks/useWizardAutoSave.ts')).toBe(false);
    expect(exists('src/hooks/useWizardCompleteness.ts')).toBe(false);
  });

  it('App.tsx só conhece /cadastro-bet e /onboarding-v2 como rotas de onboarding', () => {
    const app = read('src/App.tsx');
    // /triagem agora é redirect, não mais TriagePage.
    expect(app).not.toMatch(/element=\{<TriagePage/);
    expect(app).not.toMatch(/element=\{<TriagePreviewPage/);
    expect(app).not.toMatch(/element=\{<AdminOnboardingPage/);
    // Gate aceita apenas as rotas V3/V2.
    expect(app).toContain("location.pathname === '/cadastro-bet'");
    expect(app).toContain("location.pathname === '/onboarding-v2'");
    expect(app).toContain("location.pathname === '/onboarding-v2/sucesso'");
    // Sempre redireciona para /cadastro-bet quando incompleto.
    expect(app).toContain('to="/cadastro-bet"');
  });

  it('LoginPage e OAuth handler levam o usuário para /cadastro-bet (V3)', () => {
    const login = read('src/pages/LoginPage.tsx');
    const oauth = read('src/components/OAuthRedirectHandler.tsx');
    expect(login).toContain("navigate('/cadastro-bet'");
    expect(login).toContain("emailRedirectTo: `${window.location.origin}/cadastro-bet`");
    expect(oauth).toContain("navigate('/cadastro-bet'");
  });

  it('CTA "Cadastrar meu 1º serviço" do V3 navega ao motor V2 com source dedicada', () => {
    const bet = read('src/components/onboarding/betMode/BetModeShell.tsx');
    expect(bet).toContain("'/onboarding-v2?source=bet-first-service'");
    // Não pode haver navegação ativa para a rota legada de triagem.
    expect(bet).not.toMatch(/navigate\(['"]\/triagem/);
  });

  it('Motor V2 bloqueia regressão de fase e mostra "Já preenchido" para campos do V3', () => {
    const shell = read('src/components/onboarding/onboardingV2/OnboardingV2Shell.tsx');
    expect(shell).toContain('resolveOnboardingV2SeedState');
    expect(shell).toContain('onboarding-v2-phase-regression-blocked');
    expect(shell).toContain('Já preenchido:');
  });

  it('Pular o 1º serviço mantém o usuário dentro do wizard (não navega para o dashboard)', () => {
    const shell = read('src/components/onboarding/onboardingV2/OnboardingV2Shell.tsx');
    expect(shell).toContain("source: 'onboarding-v2-skip-first-service'");
    expect(shell).toContain("nextRoute: 'phase4_document'");
    expect(shell).not.toContain("navigate('/dashboard/servicos')");
  });

  it('Persistência do 1º serviço usa exclusivamente create_service_atomic', () => {
    const shell = read('src/components/onboarding/onboardingV2/OnboardingV2Shell.tsx');
    const services = read('src/pages/DashboardServicesPage.tsx');
    expect(shell).toContain('create_service_atomic');
    expect(services).toContain('create_service_atomic');
    expect(shell).not.toMatch(/\.from\(['"]services['"]\)\s*\.insert/);
    expect(services).not.toMatch(/\.from\(['"]services['"]\)\s*\.insert/);
  });

  it('Profissional finaliza marcando onboarding_completed=true mesmo sem serviço (anti-loop)', () => {
    const shell = read('src/components/onboarding/onboardingV2/OnboardingV2Shell.tsx');
    expect(shell).toMatch(/onboarding_step:\s*5,\s*onboarding_completed:\s*true/);
  });

  it('Sidebar admin não anuncia mais a página /admin/onboarding (V1)', () => {
    const nav = read('src/components/admin/AdminGroupNav.tsx');
    expect(nav).not.toContain("path: '/admin/onboarding'");
  });
});
