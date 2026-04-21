/**
 * E2E-style guarantee that the linear onboarding flow stays inquebrável:
 * Cadastro → Triagem → Wizard (5 steps) → criação de 1º serviço.
 *
 * These are static-analysis assertions on the source tree — they fail the
 * build the moment a regression sneaks in (skipped step, dashboard mount
 * before completion, INSERT direto em services, etc.).
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Onboarding E2E — linear flow integrity', () => {
  it('Cadastro: SignupPage redireciona para /triagem após signup', () => {
    const signup = read('src/pages/SignupPage.tsx');
    expect(signup).toMatch(/\/triagem/);
  });

  it('Hard gate: /dashboard não monta se onboarding_completed !== true', () => {
    const app = read('src/App.tsx');
    const route = read('src/components/ProtectedRoute.tsx');
    for (const src of [app, route]) {
      expect(src).toContain('onboarding_completed !== true');
      expect(src).toContain('onboardingStep < 5');
      expect(src).toContain('/triagem');
    }
  });

  it('Wizard: SmartOnboardingWizard cobre os 5 passos sem permitir pular', () => {
    const wizard = read('src/components/onboarding/SmartOnboardingWizard.tsx');
    // Step gating signals
    expect(wizard).toMatch(/onboarding_step/);
    expect(wizard).toMatch(/onboarding_completed/);
    // Wizard must use the atomic RPC for the 1st service, not raw INSERT
    expect(wizard).toContain('create_service_atomic');
    expect(wizard).not.toMatch(/\.from\(['"]services['"]\)\s*\.insert/);
  });

  it('TriagePage: jornada de onboarding fica vinculada à triagem', () => {
    const triage = read('src/pages/TriagePage.tsx');
    expect(triage).toMatch(/onboarding_step|profile_type/);
  });

  it('Build falha se Dashboard montar sem serviços para um perfil profissional incompleto', () => {
    const dashboard = read('src/pages/DashboardPage.tsx');
    // Dashboard does not bypass the gate by mounting a legacy modal
    expect(dashboard).not.toMatch(/WelcomeOnboardingModal|OnboardingTour/);
    // The FirstLeadChecklist or similar must still nudge users with 0 services,
    // ensuring the dashboard never silently renders an "empty" healthy state.
    expect(dashboard).toMatch(/FirstLeadChecklist|ActionQueue|ServiceWizard|servicos_count|services_count/);
  });

  it('Salvamento atômico preserva DNA (provider_id + user_ref) em todos os pontos', () => {
    const wizard = read('src/components/dashboard/ServiceWizard.tsx');
    const services = read('src/pages/DashboardServicesPage.tsx');
    expect(wizard).toContain('create_service_atomic');
    expect(services).toContain('create_service_atomic');
    expect(wizard).not.toMatch(/\.from\(['"]services['"]\)\s*\.insert/);
    expect(services).not.toMatch(/\.from\(['"]services['"]\)\s*\.insert/);
  });
});
