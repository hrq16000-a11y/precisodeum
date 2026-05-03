import { lazy as reactLazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
const Sonner = reactLazy(() => importWithRetry(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster }))));
const Toaster = reactLazy(() => importWithRetry(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster }))));
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AdDebugProvider } from "@/contexts/AdDebugContext";
import { WhatsAppGateProvider, WhatsAppGateInterceptor } from "@/contexts/WhatsAppGateContext";
import { importWithRetry, prefetchImportWithRetry } from "@/lib/lazyWithRetry";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminGuard from "./components/AdminGuard";
import ModuleBoundary from "./components/ModuleBoundary";
const SponsorProtectedRoute = reactLazy(() => importWithRetry(() => import("./components/SponsorProtectedRoute")));
const SponsorFeatureGate = reactLazy(() => importWithRetry(() => import("./components/sponsor/SponsorFeatureGate")));
import ErrorGuard from "./components/ErrorGuard";
import LazyRouteBoundary from "./components/LazyRouteBoundary";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
const MobileBottomNav = reactLazy(() => importWithRetry(() => import("./components/MobileBottomNav")));
const BackToTopButton = reactLazy(() => importWithRetry(() => import("./components/BackToTopButton")));
const ScrollProgressBar = reactLazy(() => importWithRetry(() => import("./components/ui/ScrollProgressBar")));
const ImpersonationBanner = reactLazy(() => importWithRetry(() => import("./components/admin/ImpersonationBanner")));
const GlobalExitIntentDialog = reactLazy(() => importWithRetry(() => import("./components/GlobalExitIntentDialog")));
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { initializeUiFreezeMonitor } from "@/lib/uiFreezeMonitor";
import { installPopupGuards } from "@/lib/popupGuards";
import { appendWizardResetDebugLog } from "@/lib/wizardResetDebug";
import { hasUnlockedAppAccess, isOnboardingCompletionGraceActive, resolveOnboardingGateTarget } from "@/lib/onboardingAccess";
import { runOnboardingSelfHeal } from "@/lib/onboardingSelfHeal";
import { fetchExistingFirstService, findExistingProvider } from "@/components/onboarding/wizard/phases/v2/findExistingRecords";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import ReportWizardErrorButton from "./components/wizard/ReportWizardErrorButton";

type LazyModule<T extends ComponentType<any>> = { default: T };
const lazy = <T extends ComponentType<any>>(importer: () => Promise<LazyModule<T>>) =>
  reactLazy(() => importWithRetry(importer));

const isTransientNetworkError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("fetch")
  );
};

// Route-level chunks — keep App shell light and split every page by route.
const Index = lazy(() => import("./pages/Index"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const CategoryCityPage = lazy(() => import("./pages/CategoryCityPage"));
const ProviderProfile = lazy(() => import("./pages/ProviderProfile"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DashboardProfilePage = lazy(() => import("./pages/DashboardProfilePage"));
const DashboardServicesPage = lazy(() => import("./pages/DashboardServicesPage"));
const DashboardOnboardingStatusPage = lazy(() => import("./pages/DashboardOnboardingStatusPage"));
const DashboardBadgeAuditPage = lazy(() => import("./pages/DashboardBadgeAuditPage"));
const DashboardLocationGuidedPage = lazy(() => import("./pages/DashboardLocationGuidedPage"));
const DashboardReviewsPage = lazy(() => import("./pages/DashboardReviewsPage"));
const DashboardLeadsPage = lazy(() => import("./pages/DashboardLeadsPage"));
const DashboardLeadDetailPage = lazy(() => import("./pages/DashboardLeadDetailPage"));
const DashboardNotificationPreferencesPage = lazy(() => import("./pages/DashboardNotificationPreferencesPage"));
const DashboardMetricsPage = lazy(() => import("./pages/DashboardMetricsPage"));
const DashboardOpenLeadsPage = lazy(() => import("./pages/DashboardOpenLeadsPage"));
const DashboardPlanPage = lazy(() => import("./pages/DashboardPlanPage"));
const DashboardMyPagePage = lazy(() => import("./pages/DashboardMyPagePage"));
const DashboardJobsPage = lazy(() => import("./pages/DashboardJobsPage"));
const DashboardCommunityPage = lazy(() => import("./pages/DashboardCommunityPage"));
const DashboardNotificationsPage = lazy(() => import("./pages/DashboardNotificationsPage"));
const DashboardPortfolioPage = lazy(() => import("./pages/DashboardPortfolioPage"));
const DashboardReferralsPage = lazy(() => import("./pages/DashboardReferralsPage"));
const DashboardRankingPage = lazy(() => import("./pages/DashboardRankingPage"));
const DashboardIdentitySuggestionsPage = lazy(() => import("./pages/DashboardIdentitySuggestionsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AdminProvidersPage = lazy(() => import("./pages/AdminProvidersPage"));
const AdminDefaultNeighborhoodPage = lazy(() => import("./pages/admin/AdminDefaultNeighborhoodPage"));
const AdminServiceAreaCorrectionsPage = lazy(() => import("./pages/admin/AdminServiceAreaCorrectionsPage"));
const AdminKillSwitchBlocksPage = lazy(() => import("./pages/admin/AdminKillSwitchBlocksPage"));
const AdminRegressionReportsPage = lazy(() => import("./pages/admin/AdminRegressionReportsPage"));
const AdminAuthMetricsPage = lazy(() => import("./pages/admin/AdminAuthMetricsPage"));
const AdminConsentRevocationsPage = lazy(() => import("./pages/admin/AdminConsentRevocationsPage"));
const AdminIntegrityReportsPage = lazy(() => import("./pages/admin/AdminIntegrityReportsPage"));
const AdminInboxPage = lazy(() => import("./pages/admin/AdminInboxPage"));
const AdminSitemapAuditPage = lazy(() => import("./pages/admin/AdminSitemapAuditPage"));
const AdminOnboardingStatsPage = lazy(() => import("./pages/admin/AdminOnboardingStatsPage"));
const AdminUploadStressTestPage = lazy(() => import("./pages/admin/AdminUploadStressTestPage"));
const AdminSearchSortingPage = lazy(() => import("./pages/admin/AdminSearchSortingPage"));
const AdminMetaTrackingQualityPage = lazy(() => import("./pages/admin/AdminMetaTrackingQualityPage"));
const AdminReviewsPage = lazy(() => import("./pages/AdminReviewsPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminCategoriesPage = lazy(() => import("./pages/AdminCategoriesPage"));
const AdminStatsPage = lazy(() => import("./pages/AdminStatsPage"));
const AdminCitiesPage = lazy(() => import("./pages/AdminCitiesPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const AdminSponsorsPage = lazy(() => import("./pages/AdminSponsorsPage"));
const AdminSponsorApprovalsPage = lazy(() => import("./pages/AdminSponsorApprovalsPage"));
const AdminPopularServicesPage = lazy(() => import("./pages/AdminPopularServicesPage"));
const AdminFaqPage = lazy(() => import("./pages/AdminFaqPage"));
const AdminMetaTagsPage = lazy(() => import("./pages/AdminMetaTagsPage"));
const AdminJobsPage = lazy(() => import("./pages/AdminJobsPage"));
const AdminJobsImportPage = lazy(() => import("./pages/AdminJobsImportPage"));
const AdminHighlightsPage = lazy(() => import("./pages/AdminHighlightsPage"));
const AdminCommunityPage = lazy(() => import("./pages/AdminCommunityPage"));
const AdminBlogPage = lazy(() => import("./pages/AdminBlogPage"));
const AdminSponsorCrmPage = lazy(() => import("./pages/AdminSponsorCrmPage"));
const AdminAdSlotsPage = lazy(() => import("./pages/AdminAdSlotsPage"));
const AdminAuditLogPage = lazy(() => import("./pages/AdminAuditLogPage"));
const AdminAuditRefPage = lazy(() => import("./pages/AdminAuditRefPage"));
const AdminAuditRlsPage = lazy(() => import("./pages/AdminAuditRlsPage"));
const AdminTrashPage = lazy(() => import("./pages/AdminTrashPage"));
const AdminBackupPage = lazy(() => import("./pages/AdminBackupPage"));
const AdminPortabilityPage = lazy(() => import("./pages/AdminPortabilityPage"));
const AdminPortabilityDetailsPage = lazy(() => import("./pages/AdminPortabilityDetailsPage"));
const AdminHeroBannersPage = lazy(() => import("./pages/AdminHeroBannersPage"));
const AdminPwaPage = lazy(() => import("./pages/AdminPwaPage"));

const AdminMediaPage = lazy(() => import("./pages/AdminMediaPage"));
const AdminServicesPage = lazy(() => import("./pages/AdminServicesPage"));
const AdminLeadsPage = lazy(() => import("./pages/AdminLeadsPage"));
const AdminModulesPage = lazy(() => import("./pages/AdminModulesPage"));
const AdminBlocksPage = lazy(() => import("./pages/AdminBlocksPage"));
const AdminInstitutionalPagesPage = lazy(() => import("./pages/AdminInstitutionalPagesPage"));
const AdminMenuPage = lazy(() => import("./pages/AdminMenuPage"));
const AdminHomeStepsPage = lazy(() => import("./pages/AdminHomeStepsPage"));
const AdminTestimonialsPage = lazy(() => import("./pages/AdminTestimonialsPage"));
const AdminCtaBlocksPage = lazy(() => import("./pages/AdminCtaBlocksPage"));
const AdminHomeSectionsPage = lazy(() => import("./pages/AdminHomeSectionsPage"));
const AdminUsersCrmPage = lazy(() => import("./pages/AdminUsersCrmPage"));
const AdminBoostsPage = lazy(() => import("./pages/AdminBoostsPage"));
const AdminBottomNavPage = lazy(() => import("./pages/AdminBottomNavPage"));

const AdminSponsorLeadsPage = lazy(() => import("./pages/AdminSponsorLeadsPage"));
const AdminSponsorDocsHistoryPage = lazy(() => import("./pages/AdminSponsorDocsHistoryPage"));
const AdminGamificationPage = lazy(() => import("./pages/AdminGamificationPage"));
const AdminRankingsPage = lazy(() => import("./pages/AdminRankingsPage"));
const AdminCoverageMapPage = lazy(() => import("./pages/AdminCoverageMapPage"));
const AdminSeoAuditPage = lazy(() => import("./pages/AdminSeoAuditPage"));
const AdminLocationDebugPage = lazy(() => import("./pages/AdminLocationDebugPage"));
const AdminLocationSeoAuditPage = lazy(() => import("./pages/AdminLocationSeoAuditPage"));
const AdminSearchAuditPage = lazy(() => import("./pages/AdminSearchAuditPage"));
const AdminHomeRotationPage = lazy(() => import("./pages/AdminHomeRotationPage"));
const AdminWizardDiagnosticsPage = lazy(() => import("./pages/AdminWizardDiagnosticsPage"));

const AdminOverviewPage = lazy(() => import("./pages/AdminOverviewPage"));
const AdminNotificationsPage = lazy(() => import("./pages/AdminNotificationsPage"));
const AdminChatPage = lazy(() => import("./pages/AdminChatPage"));
const AdminGovernancePage = lazy(() => import("./pages/AdminGovernancePage"));
const AdminSystemHealthPage = lazy(() => import("./pages/AdminSystemHealthPage"));
const AdminPermissionsPage = lazy(() => import("./pages/AdminPermissionsPage"));
const AdminStaffPage = lazy(() => import("./pages/AdminStaffPage"));
const AdminApprovalSettingsPage = lazy(() => import("./pages/AdminApprovalSettingsPage"));
const AdminOrphanProfilesPage = lazy(() => import("./pages/AdminOrphanProfilesPage"));
const DashboardChatPage = lazy(() => import("./pages/DashboardChatPage"));
const DashboardSupportPage = lazy(() => import("./pages/DashboardSupportPage"));
const InstitutionalPage = lazy(() => import("./pages/InstitutionalPage"));
const PopularServicePage = lazy(() => import("./pages/PopularServicePage"));
const SeoPage = lazy(() => import("./pages/SeoPage"));
const CityPage = lazy(() => import("./pages/CityPage"));
const CitiesListPage = lazy(() => import("./pages/CitiesListPage"));
const StateProviderPage = lazy(() => import("./pages/StateProviderPage"));
const CityDetailPage = lazy(() => import("./pages/CityDetailPage"));
const CategoriesListPage = lazy(() => import("./pages/CategoriesListPage"));
const EspecialidadesPage = lazy(() => import("./pages/EspecialidadesPage"));
const EspecialidadeDetailPage = lazy(() => import("./pages/EspecialidadeDetailPage"));
const AdminConversionMetricsPage = lazy(() => import("./pages/AdminConversionMetricsPage"));
const AdminOnboardingFunnelPage = lazy(() => import("./pages/AdminOnboardingFunnelPage"));
const AdminError500Page = lazy(() => import("./pages/AdminError500Page"));
const AdminBrokenLinksPage = lazy(() => import("./pages/admin/AdminBrokenLinksPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ComoFuncionaPage = lazy(() => import("./pages/ComoFuncionaPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ResetPasswordSuccessPage = lazy(() => import("./pages/ResetPasswordSuccessPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const SitemapRedirect = lazy(() => import("./pages/SitemapRedirect"));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetailPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage"));
const HelpOnlineOfflinePage = lazy(() => import("./pages/HelpOnlineOfflinePage"));
const HelpOnboardingPage = lazy(() => import("./pages/HelpOnboardingPage"));
const HelpSearchSortingPage = lazy(() => import("./pages/HelpSearchSortingPage"));
const RecoveryOnboardingPage = lazy(() => import("./pages/RecoveryOnboardingPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ErrorPage = lazy(() => import("./pages/ErrorPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const AccountDeletionPage = lazy(() => import("./pages/AccountDeletionPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CookiesPage = lazy(() => import("./pages/CookiesPage"));
const DashboardPrivacyPage = lazy(() => import("./pages/DashboardPrivacyPage"));
const DashboardConsentAuditPage = lazy(() => import("./pages/DashboardConsentAuditPage"));
const DashboardMyRegistrationPage = lazy(() => import("./pages/DashboardMyRegistrationPage"));
const DashboardCadastroStatusPage = lazy(() => import("./pages/DashboardCadastroStatusPage"));
const DashboardAssistantPage = lazy(() => import("./pages/DashboardAssistantPage"));
const SponsorLandingPage = lazy(() => import("./pages/SponsorLandingPage"));
const SponsorStatusPage = lazy(() => import("./pages/SponsorStatusPage"));
const SponsorSlotsPage = lazy(() => import("./pages/SponsorSlotsPage"));
const SponsorContractPage = lazy(() => import("./pages/SponsorContractPage"));
const CoursesPage = lazy(() => import("./pages/CoursesPage"));
const AdminCoursesPage = lazy(() => import("./pages/AdminCoursesPage"));
const CourseDetailPage = lazy(() => import("./pages/CourseDetailPage"));
const AgencyPublicPage = lazy(() => import("./pages/AgencyPublicPage"));
const DashboardAgencyDataPage = lazy(() => import("./pages/DashboardAgencyDataPage"));
const DashboardCompanyDataPage = lazy(() => import("./pages/DashboardCompanyDataPage"));
const SponsorPublicPage = lazy(() => import("./pages/SponsorPublicPage"));
const SponsorPublicProfilePage = lazy(() => import("./pages/sponsor/SponsorPublicProfilePage"));
const CadastroInicialPage = lazy(() => import("./pages/CadastroInicialPage"));
const OnboardingV2SuccessPage = lazy(() => import("./pages/OnboardingV2SuccessPage"));

const CookieConsent = reactLazy(() => importWithRetry(() => import("./components/CookieConsent")));
const PwaInstallBanner = reactLazy(() => importWithRetry(() => import("./components/PwaInstallBanner")));
const AppVersionGate = reactLazy(() => importWithRetry(() => import("./components/AppVersionGate")));
const OAuthRedirectHandler = reactLazy(() => importWithRetry(() => import("./components/OAuthRedirectHandler")));
const FloatingHelpButton = reactLazy(() => importWithRetry(() => import("./components/FloatingHelpButton")));

// Sponsor Panel (CRM) — isolated module
const SponsorDashboardPage = lazy(() => import("./pages/sponsor/SponsorDashboardPage"));
const SponsorBannersPage = lazy(() => import("./pages/sponsor/SponsorBannersPage"));
const SponsorCampaignsPage = lazy(() => import("./pages/sponsor/SponsorCampaignsPage"));
const SponsorMetricsPage = lazy(() => import("./pages/sponsor/SponsorMetricsPage"));
const SponsorContractsPage = lazy(() => import("./pages/sponsor/SponsorContractsPage"));
const SponsorNotificationsPage = lazy(() => import("./pages/sponsor/SponsorNotificationsPage"));
const SponsorDataPage = lazy(() => import("./pages/sponsor/SponsorDataPage"));
const SponsorSubscriptionPage = lazy(() => import("./pages/sponsor/SponsorSubscriptionPage"));

// Minimal page transition — no heavy loader, pages render instantly
const CurtainReveal = reactLazy(() => importWithRetry(() => import("./components/CurtainReveal")));

const PageFallback = () => null;

const hasRequestIdleCallback = () => typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function';
const hasCancelIdleCallback = () => typeof window !== 'undefined' && typeof (window as any).cancelIdleCallback === 'function';

import { queryClient } from '@/lib/queryClient';

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

/** Deferred UI shell — renders floating components only after initial paint to reduce TTI */
const DeferredShell = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = hasRequestIdleCallback()
      ? (window as any).requestIdleCallback(() => setReady(true), { timeout: 800 })
      : window.setTimeout(() => setReady(true), 250);
    return () => {
      if (hasCancelIdleCallback()) (window as any).cancelIdleCallback(id as number);
      else clearTimeout(id as number);
    };
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <CurtainReveal />
      <Toaster />
      <Sonner />
      <AppVersionGate />
      <ScrollProgressBar />
      <MobileBottomNav />
      <FloatingHelpButton />
      <BackToTopButton />
      <CookieConsent />
      <PwaInstallBanner />
    </Suspense>
  );
};

const RoutePrefetcher = () => {
  const location = useLocation();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefetch = () => {
      if (location.pathname === '/' || location.pathname === '/index') {
        void prefetchImportWithRetry('route-search', () => import('./pages/SearchPage'));
        void prefetchImportWithRetry('route-category', () => import('./pages/CategoryPage'));
        return;
      }
      if (location.pathname.startsWith('/buscar') || location.pathname.startsWith('/categoria/')) {
        void prefetchImportWithRetry('route-provider', () => import('./pages/ProviderProfile'));
      }
    };
    const id = 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(prefetch, { timeout: 3500 })
      : globalThis.setTimeout(prefetch, 2200);
    return () => {
      if ('cancelIdleCallback' in window) (window as any).cancelIdleCallback(id);
      else globalThis.clearTimeout(id);
    };
  }, [location.pathname]);
  return null;
};

/**
 * Rotas públicas que NÃO podem ser bloqueadas por auth/profile pendentes.
 * Renderizam imediatamente em paralelo ao handshake do Supabase,
 * eliminando 400-900ms de waterfall em conexões 3G/4G.
 */
const PUBLIC_PATH_PREFIXES = [
  '/buscar', '/categoria', '/profissional', '/empresa', '/agencia',
  '/patrocinador', '/login', '/cadastro', '/anuncie', '/vagas', '/vaga',
  '/quero-ser-patrocinador', '/sponsor', '/espacos-patrocinio',
  '/contrato-patrocinio', '/blog', '/ajuda', '/cursos', '/faq',
  '/especialidade', '/especialidades', '/popular', '/institucional',
  '/forgot-password', '/reset-password', '/cookies', '/privacidade',
  '/termos',
];

const isPublicPath = (pathname: string) => {
  if (pathname === '/' || pathname === '/index') return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
};

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, provider, loading, refetchProfile } = useAuth();
  const location = useLocation();
  const isWizardTestRoute = location.pathname === '/__test/report-button';
  const publicRoute = isPublicPath(location.pathname);


  // Self-heal idempotente para perfis legados (provider + 1º serviço já criados
  // mas com `onboarding_completed=false`). Roda no MÁXIMO uma vez por user.id
  // por aba e é totalmente desacoplada do render — o Gate em si permanece
  // 100% read-only e determinístico.
  useEffect(() => {
    if (loading) return;
    if (!user || !profile) return;
    if (profile.profile_type !== 'provider') return;
    if (profile.onboarding_completed === true) return;
    // Guard: nunca rodar self-heal enquanto o usuário está dentro do Wizard.
    // O WizardShell adquire o wizardSessionLock no mount, mas há uma janela
    // entre o Gate montar e o Shell montar onde o self-heal poderia escrever
    // onboarding_completed=true e ejetar o usuário para o /dashboard.
    if (location.pathname === '/cadastro-inicial') return;

    let cancelled = false;
    void runOnboardingSelfHeal({ userId: user.id, profile, provider })
      .then((healed) => {
        if (!cancelled && healed) void refetchProfile();
      })
      .catch((err) => {
        console.error('[selfHeal] unhandled:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, profile, provider, refetchProfile, location.pathname]);

  // [V8 PERF] Rotas públicas renderizam IMEDIATAMENTE — sem esperar auth.
  // ProtectedRoute é responsável pelo spinner/redirect em rotas privadas.
  if (publicRoute || isWizardTestRoute) {
    return <>{children}</>;
  }

  // While auth is resolving, or user exists but profile not yet loaded,
  // render an accessible skeleton instead of null to avoid blank screens.
  if (loading || (user && !profile)) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Carregando sua sessão"
        className="flex min-h-screen items-center justify-center bg-background"
      >
        <div className="w-full max-w-md space-y-3 px-4">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
        <span className="sr-only">Carregando…</span>
      </div>
    );
  }

  const onboardingStep = Number(profile?.onboarding_step ?? 0);
  // GATE GUARD (regression-locked): bloqueia o dashboard enquanto
  // `onboarding_completed !== true` — a lógica vive em `resolveOnboardingGateTarget`,
  // este comentário fica aqui para que o teste de regressão de onboarding
  // (`onboarding-regression.test.ts`) possa travar o critério via grep.
  const gateDecision = resolveOnboardingGateTarget({
    profile,
    // hasExistingService = false: a recuperação para perfis legados é
    // tratada de forma assíncrona por `runOnboardingSelfHeal` no efeito
    // acima — quando ele completa, o `refetchProfile` traz a flag atualizada
    // e este gate reavalia. Isso mantém o Gate 100% determinístico.
    hasExistingService: false,
    completionGraceActive: isOnboardingCompletionGraceActive(),
    pathname: location.pathname,
    search: location.search,
  });

  if (!isWizardTestRoute && gateDecision.action === 'redirect' && gateDecision.reason === 'global-onboarding-gate') {
    appendWizardResetDebugLog({
      source: 'onboarding-gate-redirect',
      route: `${location.pathname}${location.search}`,
      nextRoute: gateDecision.target,
      phase: null,
      reason: gateDecision.reason,
      meta: {
        profile_type: profile?.profile_type ?? null,
        onboarding_completed: profile?.onboarding_completed ?? null,
        onboarding_step: onboardingStep,
      },
    });
    return <Navigate to={gateDecision.target} replace />;
  }

  if (gateDecision.action === 'redirect' && gateDecision.reason === 'already-completed-blocking-cadastro-inicial') {
    appendWizardResetDebugLog({
      source: 'onboarding-gate-block-completed',
      route: `${location.pathname}${location.search}`,
      nextRoute: gateDecision.target,
      phase: null,
      reason: gateDecision.reason,
      meta: {
        profile_type: profile?.profile_type ?? null,
        onboarding_completed: profile?.onboarding_completed ?? null,
        had_next_param: new URLSearchParams(location.search).has('next'),
      },
    });
    return <Navigate to={gateDecision.target} replace />;
  }


  return <>{children}</>;
};

// /especialidades/:slug agora renderiza EspecialidadeDetailPage com Dicas + Top profissionais.

const App = () => {
  useEffect(() => {
    initializeUiFreezeMonitor();
    installPopupGuards();

    // Invalidate all queries if daily purge just ran
    if ((window as any).__DAILY_PURGE_TRIGGERED__) {
      delete (window as any).__DAILY_PURGE_TRIGGERED__;
      queryClient.invalidateQueries();
      console.log('[Cache] React Query invalidated (daily purge).');
    }

    return undefined;
  }, []);

  return (
    <ErrorGuard componentName="App">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PWAUpdatePrompt />
        <BrowserRouter>
          <RoutePrefetcher />
          <ScrollToTop />
            <AuthProvider>
            <AdDebugProvider>
            <WhatsAppGateProvider>
            <WhatsAppGateInterceptor />
            <Suspense fallback={null}><OAuthRedirectHandler /></Suspense>
            <Suspense fallback={null}><ImpersonationBanner /></Suspense>
            <Suspense fallback={null}><GlobalExitIntentDialog /></Suspense>
            <Suspense fallback={<PageFallback />}>
              <LazyRouteBoundary>
              <OnboardingGate>
                <Routes>
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
                {/* Wizard unificado — porta ÚNICA /cadastro-inicial. Rotas legadas /cadastro-bet,
                    /onboarding-v2 e /triagem foram REMOVIDAS na Consolidação Fase 2. Acessos
                    diretos caem em /404 — tracking de tentativas via NotFound + telemetria. */}
                <Route path="/__test/report-button" element={<WizardSupportTestHarness />} />
                <Route path="/cadastro-inicial" element={<RouteErrorBoundary sectionName="Wizard"><CadastroInicialPage /></RouteErrorBoundary>} />
                <Route path="/onboarding-v2/sucesso" element={<ProtectedRoute><OnboardingV2SuccessPage /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/dashboard/perfil" element={<ProtectedRoute><ErrorGuard componentName="DashboardProfilePage"><DashboardProfilePage /></ErrorGuard></ProtectedRoute>} />
                <Route path="/dashboard/servicos" element={<ProtectedRoute allowedTypes={['provider']}><ErrorGuard componentName="DashboardServicesPage"><DashboardServicesPage /></ErrorGuard></ProtectedRoute>} />
                <Route path="/dashboard/status" element={<ProtectedRoute allowedTypes={['provider']}><DashboardOnboardingStatusPage /></ProtectedRoute>} />
                <Route path="/dashboard/portfolio" element={<ProtectedRoute allowedTypes={['provider']}><ErrorGuard componentName="DashboardPortfolioPage"><DashboardPortfolioPage /></ErrorGuard></ProtectedRoute>} />
                <Route path="/dashboard/avaliacoes" element={<ProtectedRoute allowedTypes={['provider']}><DashboardReviewsPage /></ProtectedRoute>} />
                <Route path="/dashboard/leads" element={<ProtectedRoute allowedTypes={['provider']}><DashboardLeadsPage /></ProtectedRoute>} />
                <Route path="/dashboard/leads/:leadId" element={<ProtectedRoute allowedTypes={['provider']}><DashboardLeadDetailPage /></ProtectedRoute>} />
                <Route path="/dashboard/notificacoes/preferencias" element={<ProtectedRoute><DashboardNotificationPreferencesPage /></ProtectedRoute>} />
                <Route path="/dashboard/metricas" element={<ProtectedRoute allowedTypes={['provider']}><DashboardMetricsPage /></ProtectedRoute>} />
                <Route path="/dashboard/leads-abertos" element={<ProtectedRoute allowedTypes={['provider']}><DashboardOpenLeadsPage /></ProtectedRoute>} />
                <Route path="/dashboard/plano" element={<ProtectedRoute allowedTypes={['provider']}><DashboardPlanPage /></ProtectedRoute>} />
                <Route path="/dashboard/minha-pagina" element={<ProtectedRoute allowedTypes={['provider']}><DashboardMyPagePage /></ProtectedRoute>} />
                <Route path="/dashboard/vagas" element={<ProtectedRoute allowedTypes={['provider', 'rh']}><DashboardJobsPage /></ProtectedRoute>} />
                <Route path="/dashboard/agencia" element={<ProtectedRoute allowedTypes={['rh']}><DashboardAgencyDataPage /></ProtectedRoute>} />
                <Route path="/dashboard/empresa" element={<ProtectedRoute allowedTypes={['provider']}><DashboardCompanyDataPage /></ProtectedRoute>} />
                <Route path="/dashboard/comunidade" element={<ProtectedRoute><DashboardCommunityPage /></ProtectedRoute>} />
                <Route path="/dashboard/notificacoes" element={<ProtectedRoute><DashboardNotificationsPage /></ProtectedRoute>} />
                <Route path="/dashboard/privacidade" element={<ProtectedRoute><DashboardPrivacyPage /></ProtectedRoute>} />
                <Route path="/dashboard/auditoria-consentimentos" element={<ProtectedRoute><DashboardConsentAuditPage /></ProtectedRoute>} />
                <Route path="/dashboard/meu-cadastro" element={<ProtectedRoute><DashboardMyRegistrationPage /></ProtectedRoute>} />
                <Route path="/dashboard/cadastro-status" element={<ProtectedRoute><DashboardCadastroStatusPage /></ProtectedRoute>} />
                <Route path="/dashboard/assistente" element={<ProtectedRoute><DashboardAssistantPage /></ProtectedRoute>} />
                <Route path="/dashboard/indicacoes" element={<ProtectedRoute allowedTypes={['provider']}><DashboardReferralsPage /></ProtectedRoute>} />
                <Route path="/dashboard/ranking" element={<ProtectedRoute allowedTypes={['provider']}><DashboardRankingPage /></ProtectedRoute>} />
                <Route path="/dashboard/sugestoes-identidade" element={<ProtectedRoute><DashboardIdentitySuggestionsPage /></ProtectedRoute>} />
                <Route path="/dashboard/auditoria-bairro" element={<ProtectedRoute allowedTypes={['provider']}><DashboardBadgeAuditPage /></ProtectedRoute>} />
                <Route path="/dashboard/localizacao-guiada" element={<ProtectedRoute allowedTypes={['provider']}><DashboardLocationGuidedPage /></ProtectedRoute>} />
                <Route path="/dashboard/chat" element={<ProtectedRoute><DashboardChatPage /></ProtectedRoute>} />
                <Route path="/dashboard/suporte" element={<ProtectedRoute><DashboardSupportPage /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminGuard><RouteErrorBoundary sectionName="AdminPage"><AdminPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/prestadores" element={<AdminGuard><RouteErrorBoundary sectionName="AdminProvidersPage"><AdminProvidersPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/bairro-default" element={<AdminGuard><RouteErrorBoundary sectionName="AdminDefaultNeighborhoodPage"><AdminDefaultNeighborhoodPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/service-area-corrections" element={<AdminGuard><RouteErrorBoundary sectionName="AdminServiceAreaCorrectionsPage"><AdminServiceAreaCorrectionsPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/kill-switch-blocks" element={<AdminGuard><RouteErrorBoundary sectionName="AdminKillSwitchBlocksPage"><AdminKillSwitchBlocksPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/avaliacoes" element={<AdminGuard><RouteErrorBoundary sectionName="AdminReviewsPage"><AdminReviewsPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/usuarios" element={<AdminGuard><RouteErrorBoundary sectionName="AdminUsersPage"><AdminUsersPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/crm-usuarios" element={<AdminGuard><RouteErrorBoundary sectionName="AdminUsersCrmPage"><AdminUsersCrmPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/categorias" element={<AdminGuard><RouteErrorBoundary sectionName="AdminCategoriesPage"><AdminCategoriesPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/estatisticas" element={<AdminGuard><RouteErrorBoundary sectionName="AdminStatsPage"><AdminStatsPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/conversao" element={<AdminGuard><RouteErrorBoundary sectionName="AdminConversionMetricsPage"><AdminConversionMetricsPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/onboarding-funnel" element={<AdminGuard><RouteErrorBoundary sectionName="AdminOnboardingFunnelPage"><AdminOnboardingFunnelPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/onboarding-stats" element={<AdminGuard><RouteErrorBoundary sectionName="AdminOnboardingStatsPage"><AdminOnboardingStatsPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/integridade" element={<AdminGuard><RouteErrorBoundary sectionName="AdminIntegrityReportsPage"><AdminIntegrityReportsPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/upload-stress-test" element={<AdminGuard><RouteErrorBoundary sectionName="AdminUploadStressTestPage"><AdminUploadStressTestPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/caixa-notificacoes" element={<AdminGuard><RouteErrorBoundary sectionName="AdminInboxPage"><AdminInboxPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/sitemap-audit" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSitemapAuditPage"><AdminSitemapAuditPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/busca-ordenacao" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSearchSortingPage"><AdminSearchSortingPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/meta-tracking-quality" element={<AdminGuard><RouteErrorBoundary sectionName="AdminMetaTrackingQualityPage"><AdminMetaTrackingQualityPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/erros-500" element={<AdminError500Page />} />
                <Route path="/admin/links-quebrados" element={<AdminGuard><RouteErrorBoundary sectionName="AdminBrokenLinksPage"><AdminBrokenLinksPage /></RouteErrorBoundary></AdminGuard>} />
                <Route path="/admin/cidades" element={<AdminCitiesPage />} />
                <Route path="/admin/configuracoes" element={<AdminSettingsPage />} />
                <Route path="/admin/patrocinadores" element={<AdminSponsorsPage />} />
                <Route path="/admin/patrocinadores/aprovacoes" element={<AdminSponsorApprovalsPage />} />
                <Route path="/admin/servicos-populares" element={<AdminPopularServicesPage />} />
                <Route path="/admin/faq" element={<AdminFaqPage />} />
                <Route path="/admin/metatags" element={<AdminMetaTagsPage />} />
                <Route path="/admin/destaques" element={<AdminHighlightsPage />} />
                <Route path="/admin/comunidade" element={<AdminCommunityPage />} />
                <Route path="/admin/vagas" element={<AdminJobsPage />} />
                <Route path="/admin/vagas/importar" element={<AdminJobsImportPage />} />
                <Route path="/admin/blog" element={<AdminBlogPage />} />
                <Route path="/admin/crm-patrocinadores" element={<AdminSponsorCrmPage />} />
                <Route path="/admin/slots-anuncios" element={<AdminAdSlotsPage />} />
                <Route path="/admin/auditoria" element={<AdminAuditLogPage />} />
                <Route path="/admin/auditoria-ref" element={<AdminAuditRefPage />} />
                <Route path="/admin/auditoria-rls" element={<AdminAuditRlsPage />} />
                <Route path="/admin/backup" element={<AdminBackupPage />} />
                <Route path="/admin/portabilidade" element={<AdminPortabilityPage />} />
                <Route path="/admin/portabilidade/detalhes" element={<AdminPortabilityDetailsPage />} />
                <Route path="/admin/lixeira" element={<AdminTrashPage />} />
                <Route path="/admin/hero-banners" element={<AdminHeroBannersPage />} />
                <Route path="/admin/pwa" element={<AdminPwaPage />} />
                <Route path="/admin/regressao" element={<ProtectedRoute><AdminRegressionReportsPage /></ProtectedRoute>} />
                <Route path="/admin/metricas-auth" element={<ProtectedRoute><AdminAuthMetricsPage /></ProtectedRoute>} />
                <Route path="/admin/consent-revocations" element={<ProtectedRoute><AdminConsentRevocationsPage /></ProtectedRoute>} />
                
                <Route path="/admin/midia" element={<AdminMediaPage />} />
                <Route path="/admin/servicos" element={<AdminServicesPage />} />
                <Route path="/admin/leads" element={<AdminLeadsPage />} />
                <Route path="/admin/modulos" element={<AdminModulesPage />} />
                <Route path="/admin/blocos" element={<AdminBlocksPage />} />
                <Route path="/admin/paginas" element={<AdminInstitutionalPagesPage />} />
                <Route path="/admin/menus" element={<AdminMenuPage />} />
                <Route path="/admin/como-funciona" element={<AdminHomeStepsPage />} />
                <Route path="/admin/home-rotacao" element={<AdminHomeRotationPage />} />
                <Route path="/admin/wizard-diagnostico" element={<AdminWizardDiagnosticsPage />} />
                <Route path="/admin/depoimentos" element={<AdminTestimonialsPage />} />
                <Route path="/admin/cta-blocos" element={<AdminCtaBlocksPage />} />
                <Route path="/admin/secoes-home" element={<AdminHomeSectionsPage />} />
                <Route path="/admin/leads-patrocinadores" element={<AdminSponsorLeadsPage />} />
                <Route path="/admin/sponsor-docs-historico" element={<AdminSponsorDocsHistoryPage />} />
                
                <Route path="/admin/overview" element={<AdminOverviewPage />} />
                <Route path="/admin/notificacoes" element={<AdminNotificationsPage />} />
                <Route path="/admin/chat" element={<AdminChatPage />} />
                <Route path="/admin/boosts" element={<AdminBoostsPage />} />
                <Route path="/admin/barra-inferior" element={<AdminBottomNavPage />} />
                <Route path="/admin/governanca" element={<AdminGovernancePage />} />
                <Route path="/admin/sistema/saude" element={<AdminSystemHealthPage />} />
                <Route path="/admin/sistema/permissoes" element={<AdminPermissionsPage />} />
                <Route path="/admin/permissoes" element={<Navigate to="/admin/sistema/permissoes" replace />} />
                <Route path="/admin/gamificacao" element={<AdminGamificationPage />} />
                <Route path="/admin/rankings" element={<AdminRankingsPage />} />
                <Route path="/admin/cobertura" element={<AdminCoverageMapPage />} />
                <Route path="/admin/seo-auditoria" element={<AdminSeoAuditPage />} />
                <Route path="/admin/debug-localizacao" element={<AdminLocationDebugPage />} />
                <Route path="/admin/auditoria-cidade-uf" element={<AdminLocationSeoAuditPage />} />
                <Route path="/admin/busca-auditoria" element={<AdminSearchAuditPage />} />
                <Route path="/admin/staff" element={<AdminStaffPage />} />
                <Route path="/admin/aprovacao" element={<AdminApprovalSettingsPage />} />
                {/* /admin/onboarding removido — V1 obsoleto. Diagnóstico unificado em /admin/wizard-diagnostico. */}
                <Route path="/admin/onboarding" element={<Navigate to="/admin/wizard-diagnostico" replace />} />
                <Route path="/admin/perfis-orfaos" element={<AdminOrphanProfilesPage />} />
                <Route path="/admin/cursos" element={<AdminCoursesPage />} />
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
                {/* Sponsor Panel — CRM Module (protected B2B access) */}
                <Route path="/sponsor-panel" element={<SponsorProtectedRoute><SponsorDashboardPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/banners" element={<SponsorProtectedRoute><SponsorFeatureGate feature="banners"><SponsorBannersPage /></SponsorFeatureGate></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/campanhas" element={<SponsorProtectedRoute><SponsorFeatureGate feature="campanhas"><SponsorCampaignsPage /></SponsorFeatureGate></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/metricas" element={<SponsorProtectedRoute><SponsorFeatureGate feature="metricas"><SponsorMetricsPage /></SponsorFeatureGate></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/contratos" element={<SponsorProtectedRoute><SponsorContractsPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/notificacoes" element={<SponsorProtectedRoute><SponsorNotificationsPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/dados" element={<SponsorProtectedRoute><SponsorDataPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/pagina" element={<SponsorProtectedRoute><SponsorFeatureGate><SponsorPublicProfilePage /></SponsorFeatureGate></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/assinatura" element={<SponsorProtectedRoute><SponsorSubscriptionPage /></SponsorProtectedRoute>} />
                <Route path="/p/:slug" element={<InstitutionalPage />} />
                <Route path="/error/404" element={<ErrorPage code={404} />} />
                <Route path="/error/500" element={<ErrorPage code={500} />} />
                <Route path="/500" element={<ErrorPage code={500} />} />
                <Route path="/404" element={<ErrorPage code={404} />} />
                <Route path="*" element={<NotFound />} />
                </Routes>
              </OnboardingGate>
              </LazyRouteBoundary>
            </Suspense>
            <DeferredShell />
            </WhatsAppGateProvider>
            </AdDebugProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorGuard>
  );
};

export default App;
