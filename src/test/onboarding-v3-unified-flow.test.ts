/**
 * E2E (estático) do fluxo unificado — Consolidação Fase 2.
 *
 * Garante:
 *  - As rotas legadas /cadastro-bet, /onboarding-v2 e /triagem foram
 *    REMOVIDAS (não são mais redirects — caem em /404).
 *  - /cadastro-inicial é a porta ÚNICA do onboarding.
 *  - O WizardShell unifica os dois estágios sem trocar de URL.
 *  - O `wizardReducer` linear é a fonte ÚNICA de verdade do progresso.
 *  - A árvore plana de steps Step01_*..Step19_* existe em phases/.
 *  - PhaseCelebration sugere instalar o app via InstallAppCard.
 *  - Botão Voltar global é renderizado pelo WizardShell.
 *  - Telemetria unificada (variante 'unified') é despachada por fase.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import {
  initialWizardState,
  nextUnifiedPhase,
  prevUnifiedPhase,
  unifiedPhaseIndex,
  UNIFIED_PHASE_ORDER,
  UNIFIED_VISIBLE_PHASES,
  wizardReducer,
} from '@/components/onboarding/wizard/wizardReducer';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const exists = (p: string) => fs.existsSync(p);

describe('Onboarding — fluxo unificado (Consolidação Fase 2)', () => {
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
  });

  it('Nova estrutura wizard/ está montada (WizardShell único + reducer + steps planos)', () => {
    expect(exists('src/components/onboarding/wizard/WizardShell.tsx')).toBe(true);
    expect(exists('src/components/onboarding/wizard/wizardReducer.ts')).toBe(true);
    expect(exists('src/components/onboarding/wizard/WizardProgressBar.tsx')).toBe(true);
    expect(exists('src/components/onboarding/wizard/WizardNav.tsx')).toBe(true);
    expect(exists('src/components/onboarding/wizard/InstallAppCard.tsx')).toBe(true);
    expect(exists('src/pages/CadastroInicialPage.tsx')).toBe(true);
  });

  it('Steps planos existem como re-exports em phases/ (Step08-11 removidos em mai/2026)', () => {
    // Step08_Action / Step09_Kind / Step10_Location / Step11_Contact foram
    // removidos na consolidação Bet Mode — eram duplicações da triagem.
    const expected = [
      'Step01_Identity', 'Step02_Who', 'Step03_ClientCity', 'Step04_ProKind',
      'Step05_ProDocument', 'Step06_ProLocation', 'Step07_TriageCelebration',
      'Step12_Service', 'Step13_ServiceDetails', 'Step14_Photos',
      'Step15_Celebration', 'Step16_Document', 'Step17_Avatar',
      'Step18_ExtrasA', 'Step19_ExtrasB',
    ];
    for (const name of expected) {
      expect(exists(`src/components/onboarding/wizard/phases/${name}.tsx`)).toBe(true);
    }
    const barrel = read('src/components/onboarding/wizard/phases/index.ts');
    for (const name of expected) {
      expect(barrel).toContain(name);
    }
    // Garante que Step08-11 NÃO voltem (anti-regressão).
    for (const removed of ['Step08_Action', 'Step09_Kind', 'Step10_Location', 'Step11_Contact']) {
      expect(exists(`src/components/onboarding/wizard/phases/${removed}.tsx`)).toBe(false);
    }
  });

  it('App.tsx só conhece /cadastro-inicial (rotas legadas REMOVIDAS, não há mais Navigate)', () => {
    const app = read('src/App.tsx');
    // Gate centralizado usa helper + rota única do onboarding.
    expect(app).toContain('resolveOnboardingGateTarget');
    expect(app).toContain('to={gateDecision.target}');
    expect(app).toContain('path="/cadastro-inicial"');
    // Rotas legadas NÃO existem mais (nem como redirect).
    expect(app).not.toMatch(/path="\/cadastro-bet"/);
    expect(app).not.toMatch(/path="\/onboarding-v2"\s/);
    expect(app).not.toMatch(/path="\/triagem"/);
    // Sucesso pós-fluxo continua acessível.
    expect(app).toContain('path="/onboarding-v2/sucesso"');
  });

  it('WizardShell único renderiza orquestradores internos sem trocar de URL', () => {
    const shell = read('src/components/onboarding/wizard/WizardShell.tsx');
    expect(shell).toContain('TriageOrchestrator');
    expect(shell).toContain('MainOrchestrator');
    expect(shell).toContain('wizardReducer');
    expect(shell).toContain('WizardProgressBar');
    // Cada fase tem o seu próprio botão Voltar interno; o shell expõe
    // navegação global via wizard:request-back / source: 'global-nav'.
    expect(shell).toMatch(/source:\s*['"]global-nav['"]/);
    // Telemetria unificada por fase.
    expect(shell).toContain("variant: 'unified'");
    // Não navega entre rotas para fazer handoff.
    expect(shell).not.toMatch(/navigate\(['"]\/onboarding-v2/);
    expect(shell).not.toMatch(/navigate\(['"]\/cadastro-bet/);
  });

  it('PhaseCelebration sugere instalar o app via InstallAppCard', () => {
    const phase3 = read('src/components/onboarding/wizard/phases/v2/Phase3Celebration.tsx');
    expect(phase3).toContain('InstallAppCard');
    expect(phase3).toContain('wizard-phase3-celebration');
  });

  it('LoginPage e OAuth handler resolvem destino pós-login sem forçar wizard para quem já tem serviço', () => {
    const login = read('src/pages/LoginPage.tsx');
    const oauth = read('src/components/OAuthRedirectHandler.tsx');
    const access = read('src/lib/onboardingAccess.ts');
    expect(login).toContain('resolvePostLoginRoute');
    expect(login).toContain("emailRedirectTo: `${window.location.origin}/cadastro-inicial`");
    expect(oauth).toContain('resolvePostLoginRoute');
    expect(access).toContain('hasUnlockedAppAccess');
    expect(access).toContain("fallbackAuthorizedRoute = '/dashboard'");
  });

  it('Triagem (orquestrador interno) não navega para rotas legadas', () => {
    const bet = read('src/components/onboarding/wizard/phases/bet/BetModeShell.tsx');
    expect(bet).not.toContain('source=bet-first-service');
    expect(bet).not.toMatch(/navigate\(['"]\/onboarding-v2/);
    expect(bet).not.toMatch(/navigate\(['"]\/triagem/);
    expect(bet).toContain('onInternalHandoff');
  });

  it('Main (orquestrador interno) não lê ?source — usa prop interna', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(shell).not.toContain("searchParams.get('source')");
    expect(shell).not.toContain('bet-first-service');
    expect(shell).toContain('internalHandoffFromTriage');
    expect(shell).toContain('deferCompletionToParent');
    expect(shell).toContain('resolveOnboardingV2SeedState');
    expect(shell).toContain('onboarding-v2-phase-regression-blocked');
  });

  it('WizardShell segura a conclusão final e oferece saídas para dashboard, serviços, portfólio e app', () => {
    const shell = read('src/components/onboarding/wizard/WizardShell.tsx');
    expect(shell).toContain('deferCompletionToParent');
    expect(shell).toContain("phase: 'main_portfolio_albums'");
    expect(shell).toContain('Step21_PortfolioAlbums');
    expect(shell).toContain('finalizeUnifiedOnboarding');
    expect(shell).toContain('Continuar cadastrando serviços');
    expect(shell).toContain('Abrir portfólio');
    expect(shell).toContain('Conhecer o dashboard');
    expect(shell).toContain('InstallAppCard');
  });

  it('Etapas finais deixam claro o atalho para painel, perfil e fotos do portfólio', () => {
    const moreServices = read('src/components/onboarding/wizard/phases/Step20_MoreServices.tsx');
    const portfolio = read('src/components/onboarding/wizard/phases/Step21_PortfolioAlbums.tsx');
    expect(moreServices).toContain('Ir para meu painel');
    expect(moreServices).toContain('Ir para meu perfil');
    expect(portfolio).toContain('Como colocar fotos');
    expect(portfolio).toContain('Crie um álbum e toque nele para abrir o envio de fotos agora mesmo.');
    expect(portfolio).toContain('/dashboard/portfolio');
  });

  it('Pular 1º serviço mantém o usuário dentro do wizard', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(shell).toContain("source: 'onboarding-v2-skip-first-service'");
    expect(shell).toContain("nextRoute: 'phase4_document'");
    expect(shell).not.toContain("navigate('/dashboard/servicos')");
  });

  it('Persistência do 1º serviço prioriza create_service_atomic (fallback INSERT permitido)', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    const services = read('src/pages/DashboardServicesPage.tsx');
    // RPC atômica é o caminho primário em ambos arquivos.
    expect(shell).toContain('create_service_atomic');
    expect(services).toContain('create_service_atomic');
    // DashboardServicesPage não deve fazer INSERT direto (sempre via RPC).
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

describe('wizardReducer — máquina linear unificada', () => {
  it('possui 21 fases visíveis + done (CPF/CNPJ removido da triagem; coletado em main_document após 1º serviço)', () => {
    expect(UNIFIED_VISIBLE_PHASES).toBe(21);
    expect(UNIFIED_PHASE_ORDER).toHaveLength(22);
    expect(UNIFIED_PHASE_ORDER[0]).toBe('triage_identity');
    // triage_pro_document está presente na triagem (CPF/CNPJ opcional, valida selo).
    expect(UNIFIED_PHASE_ORDER).toContain('triage_pro_document');
    expect(UNIFIED_PHASE_ORDER[UNIFIED_PHASE_ORDER.length - 1]).toBe('done');
    // Garante que extras de serviços e portfólio são as últimas antes do done
    expect(UNIFIED_PHASE_ORDER[UNIFIED_PHASE_ORDER.length - 3]).toBe('main_more_services');
    expect(UNIFIED_PHASE_ORDER[UNIFIED_PHASE_ORDER.length - 2]).toBe('main_portfolio_albums');
  });

  it('NEXT_PHASE avança linearmente até done sem regredir', () => {
    let s = initialWizardState;
    const visited: string[] = [s.phase];
    for (let i = 0; i < UNIFIED_VISIBLE_PHASES; i++) {
      const prevIdx = unifiedPhaseIndex(s.phase);
      s = wizardReducer(s, { type: 'NEXT_PHASE' });
      const nextIdx = unifiedPhaseIndex(s.phase);
      expect(nextIdx).toBeGreaterThanOrEqual(prevIdx);
      visited.push(s.phase);
    }
    expect(s.phase).toBe('done');
  });

  it('PREV_PHASE volta uma fase mas nunca antes do início', () => {
    let s = initialWizardState;
    s = wizardReducer(s, { type: 'PREV_PHASE' });
    expect(s.phase).toBe('triage_identity');
    s = wizardReducer({ ...s, phase: 'main_service' }, { type: 'PREV_PHASE' });
    expect(s.phase).toBe('main_contact');
  });

  it('GO_TO_PHASE permite saltar (ex: pular 1º serviço para main_document)', () => {
    let s = wizardReducer(initialWizardState, { type: 'GO_TO_PHASE', phase: 'main_service' });
    s = wizardReducer(s, { type: 'GO_TO_PHASE', phase: 'main_document' });
    expect(s.phase).toBe('main_document');
    expect(unifiedPhaseIndex(s.phase)).toBeGreaterThan(unifiedPhaseIndex('main_service'));
  });

  it('PATCH_PROFILE/SERVICE/TRIAGE preservam dados existentes', () => {
    let s = wizardReducer(initialWizardState, { type: 'PATCH_PROFILE', patch: { full_name: 'Maria' } });
    s = wizardReducer(s, { type: 'PATCH_SERVICE', patch: { service_name: 'Diarista' } });
    s = wizardReducer(s, { type: 'PATCH_TRIAGE', patch: { city: 'Curitiba' } });
    expect(s.profile.full_name).toBe('Maria');
    expect(s.service.service_name).toBe('Diarista');
    expect(s.triage.city).toBe('Curitiba');
  });

  it('helpers nextUnifiedPhase/prevUnifiedPhase respeitam limites', () => {
    expect(nextUnifiedPhase('done')).toBe('done');
    expect(prevUnifiedPhase('triage_identity')).toBe('triage_identity');
    expect(nextUnifiedPhase('triage_celebration')).toBe('main_action');
  });
});
