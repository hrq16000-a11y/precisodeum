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
const AdminTrashPage = lazy(() => import("./pages/AdminTrashPage"));
const AdminBackupPage = lazy(() => import("./pages/AdminBackupPage"));
const AdminHeroBannersPage = lazy(() => import("./pages/AdminHeroBannersPage"));
const AdminPwaPage = lazy(() => import("./pages/AdminPwaPage"));
const PopularServicePage = lazy(() => import("./pages/PopularServicePage"));
const SeoPage = lazy(() => import("./pages/SeoPage"));
const CityPage = lazy(() => import("./pages/CityPage"));
const CitiesListPage = lazy(() => import("./pages/CitiesListPage"));
const CategoriesListPage = lazy(() => import("./pages/CategoriesListPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const SitemapRedirect = lazy(() => import("./pages/SitemapRedirect"));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetailPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CookiesPage = lazy(() => import("./pages/CookiesPage"));

import CookieConsent from "./components/CookieConsent";
import PwaInstallBanner from "./components/PwaInstallBanner";

// Sponsor Panel (CRM) — isolated module
const SponsorDashboardPage = lazy(() => import("./pages/sponsor/SponsorDashboardPage"));
const SponsorBannersPage = lazy(() => import("./pages/sponsor/SponsorBannersPage"));
const SponsorCampaignsPage = lazy(() => import("./pages/sponsor/SponsorCampaignsPage"));
const SponsorMetricsPage = lazy(() => import("./pages/sponsor/SponsorMetricsPage"));
const SponsorContractsPage = lazy(() => import("./pages/sponsor/SponsorContractsPage"));
const SponsorNotificationsPage = lazy(() => import("./pages/sponsor/SponsorNotificationsPage"));
const SponsorDataPage = lazy(() => import("./pages/sponsor/SponsorDataPage"));

// Minimal loading fallback (skeleton-style)
const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="space-y-3 w-full max-w-md px-4">
      <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: (failureCount, error) => {
        if (isTransientNetworkError(error)) return failureCount < 4;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 6000),
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
          <ScrollToTop />
          <AuthProvider>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/index" element={<Index />} />
                <Route path="/buscar" element={<SearchPage />} />
                <Route path="/categoria/:slug" element={<CategoryPage />} />
                <Route path="/profissional/:slug" element={<ProviderProfile />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/cadastro" element={<SignupPage />} />
                <Route path="/vagas" element={<JobsPage />} />
                <Route path="/vaga/:slug" element={<JobDetailPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/dashboard/perfil" element={<DashboardProfilePage />} />
                <Route path="/dashboard/servicos" element={<ProtectedRoute allowedTypes={['provider']}><DashboardServicesPage /></ProtectedRoute>} />
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
                <Route path="/admin/backup" element={<AdminBackupPage />} />
                <Route path="/admin/lixeira" element={<AdminTrashPage />} />
                <Route path="/admin/hero-banners" element={<AdminHeroBannersPage />} />
                <Route path="/admin/pwa" element={<AdminPwaPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/servico/:slug" element={<PopularServicePage />} />
                <Route path="/servico-detalhe/:id" element={<ServiceDetailPage />} />
                <Route path="/cidade/:slug" element={<CityPage />} />
                <Route path="/cidades" element={<CitiesListPage />} />
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
                <Route path="/:slug" element={<SeoPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <MobileBottomNav />
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
