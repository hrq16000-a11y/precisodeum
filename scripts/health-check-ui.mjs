import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => {
  console.error(`[health:ui] ${message}`);
  process.exitCode = 1;
};

const app = read('src/App.tsx');
const route = read('src/components/ProtectedRoute.tsx');
const dashboard = read('src/pages/DashboardPage.tsx');
const serviceWizard = read('src/components/dashboard/ServiceWizard.tsx');
const dashboardServices = read('src/pages/DashboardServicesPage.tsx');
const layout = read('src/components/DashboardLayout.tsx');

if (!app.includes('onboarding_completed !== true') || !app.includes('onboardingStep < 5')) {
  fail('App.tsx sem hard gate completo de onboarding.');
}
if (!route.includes('onboarding_completed !== true') || !route.includes('onboardingStep < 5')) {
  fail('ProtectedRoute.tsx sem hard gate completo de onboarding.');
}
if (/OnboardingTour|WelcomeOnboardingModal/.test(dashboard)) {
  fail('DashboardPage.tsx contém modal/tour legado capaz de bloquear cliques.');
}
if (!layout.includes('data-dashboard-main="true"')) {
  fail('DashboardLayout.tsx sem marcador principal para monitor de freeze.');
}
if (/\.from\('services'\)\s*\n\s*\.insert/.test(serviceWizard) || /\.from\('services'\)\s*\n\s*\.insert/.test(dashboardServices)) {
  fail('Cadastro de serviço voltou a usar INSERT direto em services. Use create_service_atomic.');
}
if (!serviceWizard.includes('create_service_atomic') || !dashboardServices.includes('create_service_atomic')) {
  fail('Salvamento atômico create_service_atomic ausente nos fluxos de serviço.');
}

if (process.exitCode) process.exit(process.exitCode);
console.log('[health:ui] OK — hard gate, overlays e salvamento atômico protegidos.');