/**
 * Public routes — extraídas de src/App.tsx (PR 3 · split estrutural).
 *
 * Esta é a ÚNICA fonte de verdade para `PUBLIC_PATH_PREFIXES`. O array
 * é consumido por `OnboardingGate` em App.tsx para identificar rotas
 * que renderizam sem aguardar o handshake do Supabase.
 *
 * Comportamento, paths, guards e lazy strategy preservados sem alteração.
 * O harness `/__test/report-button` só é registrado em DEV (import.meta.env.DEV)
 * para reduzir a superfície pública em produção.
 */
import { lazy as reactLazy, type ComponentType } from "react";
import { Route } from "react-router-dom";
import { importWithRetry } from "@/lib/lazyWithRetry";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import ReportWizardErrorButton from "@/components/wizard/ReportWizardErrorButton";

// Homepage eager (PR 1 · LCP). Mantido fora do split.
import Index from "@/pages/Index";

type LazyModule<T extends ComponentType<any>> = { default: T };
const lazy = <T extends ComponentType<any>>(importer: () => Promise<LazyModule<T>>) =>
  reactLazy(() => importWithRetry(importer));

const SearchPage = lazy(() => import("@/pages/SearchPage"));
const CategoryPage = lazy(() => import("@/pages/CategoryPage"));
const CategoryCityPage = lazy(() => import("@/pages/CategoryCityPage"));
const ProviderProfile = lazy(() => import("@/pages/ProviderProfile"));
const CompanyProfile = lazy(() => import("@/pages/CompanyProfile"));
const AgencyPublicPage = lazy(() => import("@/pages/AgencyPublicPage"));
const SponsorPublicPage = lazy(() => import("@/pages/SponsorPublicPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const JobsPage = lazy(() => import("@/pages/JobsPage"));
const JobDetailPage = lazy(() => import("@/pages/JobDetailPage"));
const SponsorLandingPage = lazy(() => import("@/pages/SponsorLandingPage"));
const SponsorStatusPage = lazy(() => import("@/pages/SponsorStatusPage"));
const SponsorSlotsPage = lazy(() => import("@/pages/SponsorSlotsPage"));
const SponsorContractPage = lazy(() => import("@/pages/SponsorContractPage"));
const CadastroInicialPage = lazy(() => import("@/pages/CadastroInicialPage"));
const InstitutionalPage = lazy(() => import("@/pages/InstitutionalPage"));
const PopularServicePage = lazy(() => import("@/pages/PopularServicePage"));
const CityPage = lazy(() => import("@/pages/CityPage"));
const NeighborhoodPage = lazy(() => import("@/pages/NeighborhoodPage"));
const CitiesListPage = lazy(() => import("@/pages/CitiesListPage"));
const StateProviderPage = lazy(() => import("@/pages/StateProviderPage"));
const CityDetailPage = lazy(() => import("@/pages/CityDetailPage"));
const CategoriesListPage = lazy(() => import("@/pages/CategoriesListPage"));
const EspecialidadesPage = lazy(() => import("@/pages/EspecialidadesPage"));
const EspecialidadeDetailPage = lazy(() => import("@/pages/EspecialidadeDetailPage"));
const ServicesPage = lazy(() => import("@/pages/ServicesPage"));
const ServiceDetailPage = lazy(() => import("@/pages/ServiceDetailPage"));
const FaqPage = lazy(() => import("@/pages/FaqPage"));
const HelpCenterPage = lazy(() => import("@/pages/HelpCenterPage"));
const HelpOnlineOfflinePage = lazy(() => import("@/pages/HelpOnlineOfflinePage"));
const HelpOnboardingPage = lazy(() => import("@/pages/HelpOnboardingPage"));
const HelpSearchSortingPage = lazy(() => import("@/pages/HelpSearchSortingPage"));
const RecoveryOnboardingPage = lazy(() => import("@/pages/RecoveryOnboardingPage"));
const BlogPage = lazy(() => import("@/pages/BlogPage"));
const BlogPostPage = lazy(() => import("@/pages/BlogPostPage"));
const CoursesPage = lazy(() => import("@/pages/CoursesPage"));
const CourseDetailPage = lazy(() => import("@/pages/CourseDetailPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const AccountDeletionPage = lazy(() => import("@/pages/AccountDeletionPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const CookiesPage = lazy(() => import("@/pages/CookiesPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ComoFuncionaPage = lazy(() => import("@/pages/ComoFuncionaPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const ResetPasswordSuccessPage = lazy(() => import("@/pages/ResetPasswordSuccessPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const SitemapRedirect = lazy(() => import("@/pages/SitemapRedirect"));
const SeoPage = lazy(() => import("@/pages/SeoPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ErrorPage = lazy(() => import("@/pages/ErrorPage"));

void SeoPage; // referência preservada (importação histórica)

/**
 * Prefixos de rotas públicas — fonte única de verdade.
 * NÃO duplicar este array em outro arquivo: importe daqui.
 */
export const PUBLIC_PATH_PREFIXES = [
  '/buscar', '/categoria', '/profissional', '/empresa', '/agencia',
  '/patrocinador', '/login', '/cadastro', '/anuncie', '/vagas', '/vaga',
  '/quero-ser-patrocinador', '/sponsor', '/espacos-patrocinio',
  '/contrato-patrocinio', '/blog', '/ajuda', '/cursos', '/faq',
  '/especialidade', '/especialidades', '/popular', '/institucional',
  '/forgot-password', '/reset-password', '/cookies', '/privacidade',
  '/termos',
  // Audit-fix #7 — rotas públicas que estavam bloqueadas pelo OnboardingGate
  '/sobre', '/como-funciona',
  '/cidade', '/cidades', '/categorias', '/servico', '/servicos', '/servico-detalhe',
  '/excluir-conta', '/exclusao-de-conta', '/delete-account',
  '/esqueci-senha', '/senha-redefinida', '/password-reset-success',
  '/sitemap', '/p', '/error',
] as const;

/**
 * Harness de teste de wizard — somente DEV, nunca exposto em produção.
 * Movido de App.tsx (PR 3) para reduzir superfície pública.
 */
const WizardSupportTestHarness = () => {
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const code = search?.get('code') || 'phase2_photos:no_session';
  const city = search?.get('city') || 'Curitiba';
  const category = search?.get('category') || 'cat-eletricista';
  const mode = search?.get('mode') || 'no_session';
  const lastPersistError = {
    message: search?.get('message') || 'Serviço principal não encontrado após a persistência.',
    code: search?.get('lastCode') || 'PGRST116',
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <section className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <h1 className="text-base font-semibold">Algo travou no cadastro</h1>
        <p className="text-sm text-muted-foreground">
          O fallback de erro tomou o lugar da tela em branco e manteve o contexto real do problema.
        </p>
        <div data-testid="phase2-photos-blocked" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Código: <code className="font-mono">{code}</code></p>
          <p className="mt-1 text-muted-foreground">Modo: {mode}</p>
          <div className="mt-3 flex flex-col gap-2">
            <button type="button" className="h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
              {mode === 'no_session' ? 'Fazer login novamente' : 'Voltar e revisar o serviço'}
            </button>
            <button type="button" className="h-10 rounded-md border border-border px-4 text-sm font-medium">
              {mode === 'no_session' ? 'Pular fotos por enquanto' : 'Recuperar rascunho do serviço'}
            </button>
          </div>
        </div>
        <ReportWizardErrorButton
          step={code}
          componentName="WizardSupportTestHarness"
          label="Reportar para o suporte"
          contextSnapshot={{
            code,
            category,
            city,
            stage: mode,
            has_provider: mode !== 'no_session',
            has_first_service: false,
            lastPersistError,
          }}
        />
      </section>
    </main>
  );
};

const IS_DEV = (() => {
  try { return Boolean((import.meta as any)?.env?.DEV); } catch { return false; }
})();

export const publicRoutes = (
  <>
    <Route path="/" element={<Index />} />
    <Route path="/index" element={<Index />} />
    <Route path="/buscar" element={<SearchPage />} />
    <Route path="/categoria/:slug" element={<CategoryPage />} />
    <Route path="/categoria/:slug/em/:cidade" element={<CategoryCityPage />} />
    <Route path="/profissional/:slug" element={<RouteErrorBoundary sectionName="ProviderProfile"><ProviderProfile /></RouteErrorBoundary>} />
    <Route path="/empresa/:slug" element={<CompanyProfile />} />
    <Route path="/agencia/:slug" element={<AgencyPublicPage />} />
    <Route path="/patrocinador/:slug" element={<SponsorPublicPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/cadastro" element={<LoginPage />} />
    <Route path="/cadastro/rh" element={<LoginPage />} />
    <Route path="/anuncie" element={<SponsorLandingPage />} />
    <Route path="/vagas" element={<JobsPage />} />
    <Route path="/quero-ser-patrocinador" element={<SponsorLandingPage />} />
    <Route path="/sponsor/status" element={<SponsorStatusPage />} />
    <Route path="/espacos-patrocinio" element={<SponsorSlotsPage />} />
    <Route path="/contrato-patrocinio" element={<SponsorContractPage />} />
    <Route path="/vaga/:slug" element={<JobDetailPage />} />
    {IS_DEV && (
      <Route path="/__test/report-button" element={<WizardSupportTestHarness />} />
    )}
    <Route path="/cadastro-inicial" element={<RouteErrorBoundary sectionName="Wizard"><CadastroInicialPage /></RouteErrorBoundary>} />
    <Route path="/cursos" element={<CoursesPage />} />
    <Route path="/cursos/:courseId" element={<CourseDetailPage />} />
    <Route path="/cursos/materias/:slug" element={<BlogPostPage />} />
    <Route path="/blog" element={<BlogPage />} />
    <Route path="/blog/:slug" element={<BlogPostPage />} />
    <Route path="/servico/:slug" element={<PopularServicePage />} />
    <Route path="/servicos" element={<ServicesPage />} />
    <Route path="/servico-detalhe/:id" element={<ServiceDetailPage />} />
    <Route path="/cidade/:slug" element={<CityPage />} />
    <Route path="/cidades" element={<CitiesListPage />} />
    <Route path="/cidades/:estado" element={<StateProviderPage />} />
    <Route path="/cidades/:estado/:cidade" element={<CityDetailPage />} />
    <Route path="/categorias" element={<CategoriesListPage />} />
    <Route path="/especialidades" element={<EspecialidadesPage />} />
    <Route path="/especialidades/:slug" element={<EspecialidadeDetailPage />} />
    <Route path="/faq" element={<FaqPage />} />
    <Route path="/ajuda" element={<HelpCenterPage />} />
    <Route path="/ajuda/online-offline" element={<HelpOnlineOfflinePage />} />
    <Route path="/ajuda/cadastro" element={<HelpOnboardingPage />} />
    <Route path="/ajuda/ordenacao-busca" element={<HelpSearchSortingPage />} />
    <Route path="/cadastro/retomar" element={<RecoveryOnboardingPage />} />
    <Route path="/privacidade" element={<PrivacyPage />} />
    <Route path="/excluir-conta" element={<AccountDeletionPage />} />
    <Route path="/exclusao-de-conta" element={<AccountDeletionPage />} />
    <Route path="/delete-account" element={<AccountDeletionPage />} />
    <Route path="/termos" element={<TermsPage />} />
    <Route path="/cookies" element={<CookiesPage />} />
    <Route path="/sobre" element={<AboutPage />} />
    <Route path="/como-funciona" element={<ComoFuncionaPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/senha-redefinida" element={<ResetPasswordSuccessPage />} />
    <Route path="/password-reset-success" element={<ResetPasswordSuccessPage />} />
    <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/sitemap" element={<SitemapRedirect />} />
    <Route path="/sitemap.xml" element={<SitemapRedirect />} />
    <Route path="/p/:slug" element={<InstitutionalPage />} />
    <Route path="/error/404" element={<ErrorPage code={404} />} />
    <Route path="/error/500" element={<ErrorPage code={500} />} />
    <Route path="/500" element={<ErrorPage code={500} />} />
    <Route path="/404" element={<ErrorPage code={404} />} />
    <Route path="*" element={<NotFound />} />
  </>
);

// Re-export ProtectedRoute reference path indirect to satisfy build (no usage here).
void ProtectedRoute;
