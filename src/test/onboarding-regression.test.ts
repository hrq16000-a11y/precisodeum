import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Onboarding hard gate regression guard', () => {
  it('blocks dashboard until onboarding is completed and step is 5', () => {
    const app = read('src/App.tsx');
    const route = read('src/components/ProtectedRoute.tsx');
    expect(app).toContain('onboarding_completed !== true');
    expect(app).toContain('onboardingStep < 5');
    expect(app).toContain('/cadastro-inicial');
    expect(route).toContain('The onboarding redirect');
  });

  it('registers a dedicated admin diagnostics route for wizard resets', () => {
    const app = read('src/App.tsx');
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