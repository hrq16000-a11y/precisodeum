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
const SponsorFeatureGate = reactLazy(() => importWithRetry(() => import("./components/sponsor/SponsorFeatureGate")));
import ErrorGuard from "./components/ErrorGuard";
import LazyRouteBoundary from "./components/LazyRouteBoundary";
const MobileBottomNav = reactLazy(() => importWithRetry(() => import("./components/MobileBottomNav")));
const BackToTopButton = reactLazy(() => importWithRetry(() => import("./components/BackToTopButton")));
const ScrollProgressBar = reactLazy(() => importWithRetry(() => import("./components/ui/ScrollProgressBar")));
const ImpersonationBanner = reactLazy(() => importWithRetry(() => import("./components/admin/ImpersonationBanner")));
import { useAuth } from "@/hooks/useAuth";
import { initializeUiFreezeMonitor } from "@/lib/uiFreezeMonitor";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";

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
const ErrorPage = lazy(() => import("./pages/ErrorPage"));
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
      <CurtainReveal />
      <Toaster />
      <Sonner />
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

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

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
  // Only redirect when profile EXISTS and is incomplete. Never when profile is null.
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
            <Suspense fallback={<PageFallback />}>
              <LazyRouteBoundary>
              <OnboardingGate>
                <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/index" element={<Index />} />
                <Route path="/index02" element={<Index02 />} />
                <Route path="/index02.html" element={<Index02 />} />
... keep existing code
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
