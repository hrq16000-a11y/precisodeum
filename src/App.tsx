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
import ModuleBoundary from "./components/ModuleBoundary";
const SponsorProtectedRoute = reactLazy(() => importWithRetry(() => import("./components/SponsorProtectedRoute")));
import ErrorGuard from "./components/ErrorGuard";
const MobileBottomNav = reactLazy(() => importWithRetry(() => import("./components/MobileBottomNav")));
const BackToTopButton = reactLazy(() => importWithRetry(() => import("./components/BackToTopButton")));
const ScrollProgressBar = reactLazy(() => importWithRetry(() => import("./components/ui/ScrollProgressBar")));
const ImpersonationBanner = reactLazy(() => importWithRetry(() => import("./components/admin/ImpersonationBanner")));
import { useAuth } from "@/hooks/useAuth";
import { initializeUiFreezeMonitor } from "@/lib/uiFreezeMonitor";

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

// Index — eagerly loaded to avoid CinematicLoader blocking LCP
import Index from "./pages/Index";

// Lazy loaded pages
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const ProviderProfile = lazy(() => import("./pages/ProviderProfile"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DashboardProfilePage = lazy(() => import("./pages/DashboardProfilePage"));
const DashboardServicesPage = lazy(() => import("./pages/DashboardServicesPage"));
const DashboardReviewsPage = lazy(() => import("./pages/DashboardReviewsPage"));
const DashboardLeadsPage = lazy(() => import("./pages/DashboardLeadsPage"));
const DashboardMetricsPage = lazy(() => import("./pages/DashboardMetricsPage"));
const DashboardOpenLeadsPage = lazy(() => import("./pages/DashboardOpenLeadsPage"));
const DashboardPlanPage = lazy(() => import("./pages/DashboardPlanPage"));
const DashboardMyPagePage = lazy(() => import("./pages/DashboardMyPagePage"));
const DashboardJobsPage = lazy(() => import("./pages/DashboardJobsPage"));
const DashboardCommunityPage = lazy(() => import("./pages/DashboardCommunityPage"));
const DashboardNotificationsPage = lazy(() => import("./pages/DashboardNotificationsPage"));
const DashboardPortfolioPage = lazy(() => import("./pages/DashboardPortfolioPage"));
const DashboardReferralsPage = lazy(() => import("./pages/DashboardReferralsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AdminProvidersPage = lazy(() => import("./pages/AdminProvidersPage"));
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
const AdminHighlightsPage = lazy(() => import("./pages/AdminHighlightsPage"));
const AdminCommunityPage = lazy(() => import("./pages/AdminCommunityPage"));
const AdminBlogPage = lazy(() => import("./pages/AdminBlogPage"));
const AdminSponsorCrmPage = lazy(() => import("./pages/AdminSponsorCrmPage"));
const AdminAdSlotsPage = lazy(() => import("./pages/AdminAdSlotsPage"));
const AdminAuditLogPage = lazy(() => import("./pages/AdminAuditLogPage"));
const AdminAuditRefPage = lazy(() => import("./pages/AdminAuditRefPage"));
const AdminTrashPage = lazy(() => import("./pages/AdminTrashPage"));
const AdminBackupPage = lazy(() => import("./pages/AdminBackupPage"));
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
const AdminGamificationPage = lazy(() => import("./pages/AdminGamificationPage"));
const AdminRankingsPage = lazy(() => import("./pages/AdminRankingsPage"));

const AdminOverviewPage = lazy(() => import("./pages/AdminOverviewPage"));
const AdminNotificationsPage = lazy(() => import("./pages/AdminNotificationsPage"));
const AdminChatPage = lazy(() => import("./pages/AdminChatPage"));
const AdminGovernancePage = lazy(() => import("./pages/AdminGovernancePage"));
const AdminSystemHealthPage = lazy(() => import("./pages/AdminSystemHealthPage"));
const AdminPermissionsPage = lazy(() => import("./pages/AdminPermissionsPage"));
const AdminStaffPage = lazy(() => import("./pages/AdminStaffPage"));
const AdminApprovalSettingsPage = lazy(() => import("./pages/AdminApprovalSettingsPage"));
const AdminOnboardingPage = lazy(() => import("./pages/AdminOnboardingPage"));
const DashboardChatPage = lazy(() => import("./pages/DashboardChatPage"));
const InstitutionalPage = lazy(() => import("./pages/InstitutionalPage"));
const PopularServicePage = lazy(() => import("./pages/PopularServicePage"));
const SeoPage = lazy(() => import("./pages/SeoPage"));
const CityPage = lazy(() => import("./pages/CityPage"));
const CitiesListPage = lazy(() => import("./pages/CitiesListPage"));
const StateProviderPage = lazy(() => import("./pages/StateProviderPage"));
const CityDetailPage = lazy(() => import("./pages/CityDetailPage"));
const CategoriesListPage = lazy(() => import("./pages/CategoriesListPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ComoFuncionaPage = lazy(() => import("./pages/ComoFuncionaPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const SitemapRedirect = lazy(() => import("./pages/SitemapRedirect"));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetailPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Index02 = lazy(() => import("./pages/Index02"));
const Index03 = lazy(() => import("./pages/Index03"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CookiesPage = lazy(() => import("./pages/CookiesPage"));
const SponsorLandingPage = lazy(() => import("./pages/SponsorLandingPage"));
const SponsorSlotsPage = lazy(() => import("./pages/SponsorSlotsPage"));
const SponsorContractPage = lazy(() => import("./pages/SponsorContractPage"));
const CoursesPage = lazy(() => import("./pages/CoursesPage"));
const AdminCoursesPage = lazy(() => import("./pages/AdminCoursesPage"));
const CourseDetailPage = lazy(() => import("./pages/CourseDetailPage"));
const AgencyPublicPage = lazy(() => import("./pages/AgencyPublicPage"));
const DashboardAgencyDataPage = lazy(() => import("./pages/DashboardAgencyDataPage"));
const SponsorPublicPage = lazy(() => import("./pages/SponsorPublicPage"));
const SponsorPublicProfilePage = lazy(() => import("./pages/sponsor/SponsorPublicProfilePage"));
const TriagePage = lazy(() => import("./pages/TriagePage"));

const CookieConsent = reactLazy(() => importWithRetry(() => import("./components/CookieConsent")));
const PwaInstallBanner = reactLazy(() => importWithRetry(() => import("./components/PwaInstallBanner")));
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

// Minimal page transition — no heavy loader, pages render instantly
const CurtainReveal = reactLazy(() => importWithRetry(() => import("./components/CurtainReveal")));

const PageFallback = () => null;

const hasRequestIdleCallback = () => typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function';
const hasCancelIdleCallback = () => typeof window !== 'undefined' && typeof (window as any).cancelIdleCallback === 'function';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        if (isTransientNetworkError(error)) return failureCount < 3;
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});

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
      <ScrollProgressBar />
      <MobileBottomNav />
      <FloatingHelpButton />
      <BackToTopButton />
      <CookieConsent />
      <PwaInstallBanner />
    </Suspense>
  );
};

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  const onboardingStep = Number(profile?.onboarding_step ?? 0);
  const mustCompleteOnboarding = !!user && !!profile && (
    !profile.profile_type ||
    profile.onboarding_completed !== true ||
    onboardingStep < 5
  );

  if (mustCompleteOnboarding && location.pathname !== '/triagem') {
    return <Navigate to="/triagem" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  useEffect(() => {
    initializeUiFreezeMonitor();

    // Invalidate all queries if daily purge just ran
    if ((window as any).__DAILY_PURGE_TRIGGERED__) {
      delete (window as any).__DAILY_PURGE_TRIGGERED__;
      queryClient.invalidateQueries();
      console.log('[Cache] React Query invalidated (daily purge).');
    }

    const startPrefetch = () => {
      void Promise.allSettled([
        prefetchImportWithRetry("route-search-page", () => import("./pages/SearchPage")),
        prefetchImportWithRetry("route-category-page", () => import("./pages/CategoryPage")),
      ]);
    };
    const hasIdleCb = typeof (window as any).requestIdleCallback === 'function';
    let cleanupFn: (() => void) | undefined;
    if (hasIdleCb) {
      const idleId = (window as any).requestIdleCallback(startPrefetch, { timeout: 15000 });
      cleanupFn = () => (window as any).cancelIdleCallback(idleId);
    } else {
      const timerId = globalThis.setTimeout(startPrefetch, 8000);
      cleanupFn = () => globalThis.clearTimeout(timerId);
    }

    return () => cleanupFn?.();
  }, []);

  return (
    <ErrorGuard componentName="App">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Suspense fallback={null}><Toaster /></Suspense>
        <Suspense fallback={null}><Sonner /></Suspense>
        <BrowserRouter>
          <Suspense fallback={null}><CurtainReveal /></Suspense>
          <ScrollToTop />
            <AuthProvider>
            <AdDebugProvider>
            <WhatsAppGateProvider>
            <WhatsAppGateInterceptor />
            <Suspense fallback={null}><OAuthRedirectHandler /></Suspense>
            <Suspense fallback={null}><ImpersonationBanner /></Suspense>
            <Suspense fallback={<PageFallback />}>
              <OnboardingGate>
                <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/index" element={<Index />} />
                <Route path="/index02" element={<Index02 />} />
                <Route path="/index02.html" element={<Index02 />} />
                <Route path="/index02.php" element={<Index02 />} />
                <Route path="/pg03" element={<Index03 />} />
                <Route path="/pg03.html" element={<Index03 />} />
                <Route path="/index03" element={<Index03 />} />
                <Route path="/buscar" element={<SearchPage />} />
                <Route path="/categoria/:slug" element={<CategoryPage />} />
                <Route path="/profissional/:slug" element={<ProviderProfile />} />
                <Route path="/agencia/:slug" element={<AgencyPublicPage />} />
                <Route path="/patrocinador/:slug" element={<SponsorPublicPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/cadastro" element={<LoginPage />} />
                <Route path="/cadastro/rh" element={<LoginPage />} />
                <Route path="/anuncie" element={<SponsorLandingPage />} />
                <Route path="/vagas" element={<JobsPage />} />
                <Route path="/quero-ser-patrocinador" element={<SponsorLandingPage />} />
                <Route path="/espacos-patrocinio" element={<SponsorSlotsPage />} />
                <Route path="/contrato-patrocinio" element={<SponsorContractPage />} />
                <Route path="/vaga/:slug" element={<JobDetailPage />} />
                <Route path="/triagem" element={<TriagePage />} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/dashboard/perfil" element={<ProtectedRoute><ErrorGuard componentName="DashboardProfilePage"><DashboardProfilePage /></ErrorGuard></ProtectedRoute>} />
                <Route path="/dashboard/servicos" element={<ProtectedRoute allowedTypes={['provider']}><ErrorGuard componentName="DashboardServicesPage"><DashboardServicesPage /></ErrorGuard></ProtectedRoute>} />
                <Route path="/dashboard/portfolio" element={<ProtectedRoute allowedTypes={['provider']}><ErrorGuard componentName="DashboardPortfolioPage"><DashboardPortfolioPage /></ErrorGuard></ProtectedRoute>} />
                <Route path="/dashboard/avaliacoes" element={<ProtectedRoute allowedTypes={['provider']}><DashboardReviewsPage /></ProtectedRoute>} />
                <Route path="/dashboard/leads" element={<ProtectedRoute allowedTypes={['provider']}><DashboardLeadsPage /></ProtectedRoute>} />
                <Route path="/dashboard/metricas" element={<ProtectedRoute allowedTypes={['provider']}><DashboardMetricsPage /></ProtectedRoute>} />
                <Route path="/dashboard/leads-abertos" element={<ProtectedRoute allowedTypes={['provider']}><DashboardOpenLeadsPage /></ProtectedRoute>} />
                <Route path="/dashboard/plano" element={<ProtectedRoute allowedTypes={['provider']}><DashboardPlanPage /></ProtectedRoute>} />
                <Route path="/dashboard/minha-pagina" element={<ProtectedRoute allowedTypes={['provider']}><DashboardMyPagePage /></ProtectedRoute>} />
                <Route path="/dashboard/vagas" element={<ProtectedRoute allowedTypes={['provider', 'rh']}><DashboardJobsPage /></ProtectedRoute>} />
                <Route path="/dashboard/agencia" element={<ProtectedRoute allowedTypes={['rh']}><DashboardAgencyDataPage /></ProtectedRoute>} />
                <Route path="/dashboard/comunidade" element={<ProtectedRoute><DashboardCommunityPage /></ProtectedRoute>} />
                <Route path="/dashboard/notificacoes" element={<ProtectedRoute><DashboardNotificationsPage /></ProtectedRoute>} />
                <Route path="/dashboard/indicacoes" element={<ProtectedRoute allowedTypes={['provider']}><DashboardReferralsPage /></ProtectedRoute>} />
                <Route path="/dashboard/chat" element={<ProtectedRoute><DashboardChatPage /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/prestadores" element={<AdminProvidersPage />} />
                <Route path="/admin/avaliacoes" element={<AdminReviewsPage />} />
                <Route path="/admin/usuarios" element={<AdminUsersPage />} />
                <Route path="/admin/crm-usuarios" element={<AdminUsersCrmPage />} />
                <Route path="/admin/categorias" element={<AdminCategoriesPage />} />
                <Route path="/admin/estatisticas" element={<AdminStatsPage />} />
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
                <Route path="/admin/blog" element={<AdminBlogPage />} />
                <Route path="/admin/crm-patrocinadores" element={<AdminSponsorCrmPage />} />
                <Route path="/admin/slots-anuncios" element={<AdminAdSlotsPage />} />
                <Route path="/admin/auditoria" element={<AdminAuditLogPage />} />
                <Route path="/admin/auditoria-ref" element={<AdminAuditRefPage />} />
                <Route path="/admin/backup" element={<AdminBackupPage />} />
                <Route path="/admin/lixeira" element={<AdminTrashPage />} />
                <Route path="/admin/hero-banners" element={<AdminHeroBannersPage />} />
                <Route path="/admin/pwa" element={<AdminPwaPage />} />
                
                <Route path="/admin/midia" element={<AdminMediaPage />} />
                <Route path="/admin/servicos" element={<AdminServicesPage />} />
                <Route path="/admin/leads" element={<AdminLeadsPage />} />
                <Route path="/admin/modulos" element={<AdminModulesPage />} />
                <Route path="/admin/blocos" element={<AdminBlocksPage />} />
                <Route path="/admin/paginas" element={<AdminInstitutionalPagesPage />} />
                <Route path="/admin/menus" element={<AdminMenuPage />} />
                <Route path="/admin/como-funciona" element={<AdminHomeStepsPage />} />
                <Route path="/admin/depoimentos" element={<AdminTestimonialsPage />} />
                <Route path="/admin/cta-blocos" element={<AdminCtaBlocksPage />} />
                <Route path="/admin/secoes-home" element={<AdminHomeSectionsPage />} />
                <Route path="/admin/leads-patrocinadores" element={<AdminSponsorLeadsPage />} />
                
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
                <Route path="/admin/staff" element={<AdminStaffPage />} />
                <Route path="/admin/aprovacao" element={<AdminApprovalSettingsPage />} />
                <Route path="/admin/onboarding" element={<AdminOnboardingPage />} />
                <Route path="/admin/cursos" element={<AdminCoursesPage />} />
                <Route path="/cursos" element={<CoursesPage />} />
                <Route path="/cursos/:courseId" element={<CourseDetailPage />} />
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
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/ajuda" element={<HelpCenterPage />} />
                <Route path="/privacidade" element={<PrivacyPage />} />
                <Route path="/termos" element={<TermsPage />} />
                <Route path="/cookies" element={<CookiesPage />} />
                <Route path="/sobre" element={<AboutPage />} />
                <Route path="/como-funciona" element={<ComoFuncionaPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/sitemap" element={<SitemapRedirect />} />
                <Route path="/sitemap.xml" element={<SitemapRedirect />} />
                {/* Sponsor Panel — CRM Module (protected B2B access) */}
                <Route path="/sponsor-panel" element={<SponsorProtectedRoute><SponsorDashboardPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/banners" element={<SponsorProtectedRoute><SponsorBannersPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/campanhas" element={<SponsorProtectedRoute><SponsorCampaignsPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/metricas" element={<SponsorProtectedRoute><SponsorMetricsPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/contratos" element={<SponsorProtectedRoute><SponsorContractsPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/notificacoes" element={<SponsorProtectedRoute><SponsorNotificationsPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/dados" element={<SponsorProtectedRoute><SponsorDataPage /></SponsorProtectedRoute>} />
                <Route path="/sponsor-panel/pagina" element={<SponsorProtectedRoute><SponsorPublicProfilePage /></SponsorProtectedRoute>} />
                <Route path="/p/:slug" element={<InstitutionalPage />} />
                <Route path="/:slug" element={<SeoPage />} />
                <Route path="*" element={<NotFound />} />
                </Routes>
              </OnboardingGate>
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
