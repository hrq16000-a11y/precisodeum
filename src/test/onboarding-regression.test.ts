import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Onboarding hard gate regression guard', () => {
  it('blocks dashboard until onboarding is completed and step is 5', () => {
    const app = read('src/App.tsx');
    const route = read('src/components/ProtectedRoute.tsx');
    for (const source of [app, route]) {
      expect(source).toContain('onboarding_completed !== true');
      expect(source).toContain('onboardingStep < 5');
      expect(source).toContain('/triagem');
    }
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