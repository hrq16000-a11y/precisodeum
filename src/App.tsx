import { lazy as reactLazy, Suspense, useEffect, type ComponentType } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { importWithRetry, prefetchImportWithRetry } from "@/lib/lazyWithRetry";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import ModuleBoundary from "./components/ModuleBoundary";
import MobileBottomNav from "./components/MobileBottomNav";
import BackToTopButton from "./components/BackToTopButton";
import ScrollProgressBar from "./components/ui/ScrollProgressBar";
import ProfileTypeChooser from "./components/ProfileTypeChooser";
import { useAuth } from "@/hooks/useAuth";

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

// Eagerly loaded (critical path)
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
const DashboardPlanPage = lazy(() => import("./pages/DashboardPlanPage"));
const DashboardMyPagePage = lazy(() => import("./pages/DashboardMyPagePage"));
const DashboardJobsPage = lazy(() => import("./pages/DashboardJobsPage"));
const DashboardCommunityPage = lazy(() => import("./pages/DashboardCommunityPage"));
const DashboardNotificationsPage = lazy(() => import("./pages/DashboardNotificationsPage"));
const DashboardPortfolioPage = lazy(() => import("./pages/DashboardPortfolioPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AdminProvidersPage = lazy(() => import("./pages/AdminProvidersPage"));
const AdminReviewsPage = lazy(() => import("./pages/AdminReviewsPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminCategoriesPage = lazy(() => import("./pages/AdminCategoriesPage"));
const AdminStatsPage = lazy(() => import("./pages/AdminStatsPage"));
const AdminCitiesPage = lazy(() => import("./pages/AdminCitiesPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const AdminSponsorsPage = lazy(() => import("./pages/AdminSponsorsPage"));
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
const AdminTierRulesPage = lazy(() => import("./pages/AdminTierRulesPage"));
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
const AdminLevelsPage = lazy(() => import("./pages/AdminLevelsPage"));
const AdminAccountTypesPage = lazy(() => import("./pages/AdminAccountTypesPage"));
const AdminSponsorLeadsPage = lazy(() => import("./pages/AdminSponsorLeadsPage"));
const AdminSubscriptionsPage = lazy(() => import("./pages/AdminSubscriptionsPage"));
const AdminOverviewPage = lazy(() => import("./pages/AdminOverviewPage"));
const InstitutionalPage = lazy(() => import("./pages/InstitutionalPage"));
const PopularServicePage = lazy(() => import("./pages/PopularServicePage"));
const SeoPage = lazy(() => import("./pages/SeoPage"));
const CityPage = lazy(() => import("./pages/CityPage"));
const CitiesListPage = lazy(() => import("./pages/CitiesListPage"));
const StateProviderPage = lazy(() => import("./pages/StateProviderPage"));
const CategoriesListPage = lazy(() => import("./pages/CategoriesListPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const SitemapRedirect = lazy(() => import("./pages/SitemapRedirect"));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetailPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
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

import CookieConsent from "./components/CookieConsent";
import PwaInstallBanner from "./components/PwaInstallBanner";
import OAuthRedirectHandler from "./components/OAuthRedirectHandler";

// Sponsor Panel (CRM) — isolated module
const SponsorDashboardPage = lazy(() => import("./pages/sponsor/SponsorDashboardPage"));
const SponsorBannersPage = lazy(() => import("./pages/sponsor/SponsorBannersPage"));
const SponsorCampaignsPage = lazy(() => import("./pages/sponsor/SponsorCampaignsPage"));
const SponsorMetricsPage = lazy(() => import("./pages/sponsor/SponsorMetricsPage"));
const SponsorContractsPage = lazy(() => import("./pages/sponsor/SponsorContractsPage"));
const SponsorNotificationsPage = lazy(() => import("./pages/sponsor/SponsorNotificationsPage"));
const SponsorDataPage = lazy(() => import("./pages/sponsor/SponsorDataPage"));

// Cinematic loading fallback
import CinematicLoader from './components/CinematicLoader';
import CurtainReveal from './components/CurtainReveal';

const PageFallback = () => <CinematicLoader />;

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

/** Shows profile type chooser overlay for social login users who haven't picked a type */
const TypeSelectionGate = () => {
  const { needsTypeSelection, loading } = useAuth();
  if (loading || !needsTypeSelection) return null;
  return <ProfileTypeChooser />;
};

const App = () => {
  useEffect(() => {
    // Invalidate all queries if daily purge just ran
    if ((window as any).__DAILY_PURGE_TRIGGERED__) {
      delete (window as any).__DAILY_PURGE_TRIGGERED__;
      queryClient.invalidateQueries();
      console.log('[Cache] React Query invalidated (daily purge).');
    }

    const timeoutId = window.setTimeout(() => {
      void Promise.allSettled([
        prefetchImportWithRetry("route-search-page", () => import("./pages/SearchPage")),
        prefetchImportWithRetry("route-provider-profile", () => import("./pages/ProviderProfile")),
        prefetchImportWithRetry("route-category-page", () => import("./pages/CategoryPage")),
      ]);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CurtainReveal />
          <ScrollToTop />
          <AuthProvider>
            <OAuthRedirectHandler />
            <Suspense fallback={<PageFallback />}>
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
                <Route path="/login" element={<LoginPage />} />
                <Route path="/cadastro" element={<SignupPage />} />
                <Route path="/vagas" element={<JobsPage />} />
                <Route path="/quero-ser-patrocinador" element={<SponsorLandingPage />} />
                <Route path="/espacos-patrocinio" element={<SponsorSlotsPage />} />
                <Route path="/contrato-patrocinio" element={<SponsorContractPage />} />
                <Route path="/vaga/:slug" element={<JobDetailPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/dashboard/perfil" element={<DashboardProfilePage />} />
                <Route path="/dashboard/servicos" element={<ProtectedRoute allowedTypes={['provider']}><DashboardServicesPage /></ProtectedRoute>} />
                <Route path="/dashboard/portfolio" element={<ProtectedRoute allowedTypes={['provider']}><DashboardPortfolioPage /></ProtectedRoute>} />
                <Route path="/dashboard/avaliacoes" element={<ProtectedRoute allowedTypes={['provider']}><DashboardReviewsPage /></ProtectedRoute>} />
                <Route path="/dashboard/leads" element={<ProtectedRoute allowedTypes={['provider']}><DashboardLeadsPage /></ProtectedRoute>} />
                <Route path="/dashboard/plano" element={<ProtectedRoute allowedTypes={['provider']}><DashboardPlanPage /></ProtectedRoute>} />
                <Route path="/dashboard/minha-pagina" element={<ProtectedRoute allowedTypes={['provider']}><DashboardMyPagePage /></ProtectedRoute>} />
                <Route path="/dashboard/vagas" element={<ProtectedRoute allowedTypes={['provider', 'rh']}><DashboardJobsPage /></ProtectedRoute>} />
                <Route path="/dashboard/comunidade" element={<DashboardCommunityPage />} />
                <Route path="/dashboard/notificacoes" element={<DashboardNotificationsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/prestadores" element={<AdminProvidersPage />} />
                <Route path="/admin/avaliacoes" element={<AdminReviewsPage />} />
                <Route path="/admin/usuarios" element={<AdminUsersPage />} />
                <Route path="/admin/crm-usuarios" element={<AdminUsersCrmPage />} />
                <Route path="/admin/niveis" element={<AdminLevelsPage />} />
                <Route path="/admin/tipos-conta" element={<AdminAccountTypesPage />} />
                <Route path="/admin/categorias" element={<AdminCategoriesPage />} />
                <Route path="/admin/estatisticas" element={<AdminStatsPage />} />
                <Route path="/admin/cidades" element={<AdminCitiesPage />} />
                <Route path="/admin/configuracoes" element={<AdminSettingsPage />} />
                <Route path="/admin/patrocinadores" element={<AdminSponsorsPage />} />
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
                <Route path="/admin/regras" element={<AdminTierRulesPage />} />
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
                <Route path="/admin/assinaturas" element={<AdminSubscriptionsPage />} />
                <Route path="/admin/overview" element={<AdminOverviewPage />} />
                <Route path="/admin/boosts" element={<AdminBoostsPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/servico/:slug" element={<PopularServicePage />} />
                <Route path="/servicos" element={<ServicesPage />} />
                <Route path="/servico-detalhe/:id" element={<ServiceDetailPage />} />
                <Route path="/cidade/:slug" element={<CityPage />} />
                <Route path="/cidades" element={<CitiesListPage />} />
                <Route path="/cidades/:estado" element={<StateProviderPage />} />
                <Route path="/categorias" element={<CategoriesListPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/privacidade" element={<PrivacyPage />} />
                <Route path="/termos" element={<TermsPage />} />
                <Route path="/cookies" element={<CookiesPage />} />
                <Route path="/sobre" element={<AboutPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/sitemap" element={<SitemapRedirect />} />
                <Route path="/sitemap.xml" element={<SitemapRedirect />} />
                {/* Sponsor Panel — CRM Module (isolated) */}
                <Route path="/sponsor-panel" element={<ModuleBoundary moduleName="CRM Patrocinador"><SponsorDashboardPage /></ModuleBoundary>} />
                <Route path="/sponsor-panel/banners" element={<ModuleBoundary moduleName="CRM Patrocinador"><SponsorBannersPage /></ModuleBoundary>} />
                <Route path="/sponsor-panel/campanhas" element={<ModuleBoundary moduleName="CRM Patrocinador"><SponsorCampaignsPage /></ModuleBoundary>} />
                <Route path="/sponsor-panel/metricas" element={<ModuleBoundary moduleName="CRM Patrocinador"><SponsorMetricsPage /></ModuleBoundary>} />
                <Route path="/sponsor-panel/contratos" element={<ModuleBoundary moduleName="CRM Patrocinador"><SponsorContractsPage /></ModuleBoundary>} />
                <Route path="/sponsor-panel/notificacoes" element={<ModuleBoundary moduleName="CRM Patrocinador"><SponsorNotificationsPage /></ModuleBoundary>} />
                <Route path="/sponsor-panel/dados" element={<ModuleBoundary moduleName="CRM Patrocinador"><SponsorDataPage /></ModuleBoundary>} />
                <Route path="/p/:slug" element={<InstitutionalPage />} />
                <Route path="/:slug" element={<SeoPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <ScrollProgressBar />
            <MobileBottomNav />
            <BackToTopButton />
            <CookieConsent />
            <PwaInstallBanner />
            <TypeSelectionGate />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
