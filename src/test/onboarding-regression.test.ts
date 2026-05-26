import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Onboarding hard gate regression guard', () => {
  it('blocks dashboard until onboarding is completed and step is 5', async () => {
    // PR 3 split: gate centralizado vive em App.tsx + src/routes/*.
    const { readRouterSources } = await import('./helpers/routerSources');
    const app: string = readRouterSources();
    expect(app).toContain('onboarding_completed !== true');
    expect(app).not.toContain('onboardingStep < 5');
    expect(app).toContain('/cadastro-inicial');
    // O gate é resolvido por um helper compartilhado (intenção do antigo
    // comentário em ProtectedRoute, hoje no App.tsx).
    expect(app).toContain('resolveOnboardingGateTarget');
  });

  it('registers a dedicated admin diagnostics route for wizard resets', async () => {
    const { readRouterSources } = await import('./helpers/routerSources');
    const app: string = readRouterSources();
    const adminNav = read('src/components/admin/AdminGroupNav.tsx');
    expect(app).toContain('/admin/wizard-diagnostico');
    expect(adminNav).toContain('/admin/wizard-diagnostico');
  });

  it('does not mount legacy onboarding overlays in DashboardPage', () => {
    const dashboard = read('src/pages/DashboardPage.tsx');
    expect(dashboard).not.toMatch(/WelcomeOnboardingModal|OnboardingTour/);
  });

  it('keeps service creation atomic and tied to user_ref/provider_id', () => {
    const wizard = read('src/components/dashboard/ServiceWizard.tsx');
    const servicesPage = read('src/pages/DashboardServicesPage.tsx');
    expect(wizard).toContain('create_service_atomic');
    expect(servicesPage).toContain('create_service_atomic');
    expect(wizard).not.toMatch(/\.from\('services'\)\s*\n\s*\.insert/);
    expect(servicesPage).not.toMatch(/\.from\('services'\)\s*\n\s*\.insert/);
  });
});