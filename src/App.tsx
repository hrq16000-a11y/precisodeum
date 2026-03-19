import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SearchPage from "./pages/SearchPage";
import CategoryPage from "./pages/CategoryPage";
import ProviderProfile from "./pages/ProviderProfile";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import DashboardProfilePage from "./pages/DashboardProfilePage";
import DashboardServicesPage from "./pages/DashboardServicesPage";
import DashboardReviewsPage from "./pages/DashboardReviewsPage";
import DashboardLeadsPage from "./pages/DashboardLeadsPage";
import DashboardPlanPage from "./pages/DashboardPlanPage";
import DashboardMyPagePage from "./pages/DashboardMyPagePage";
import DashboardJobsPage from "./pages/DashboardJobsPage";
import AdminPage from "./pages/AdminPage";
import AdminProvidersPage from "./pages/AdminProvidersPage";
import AdminReviewsPage from "./pages/AdminReviewsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage";
import AdminStatsPage from "./pages/AdminStatsPage";
import AdminCitiesPage from "./pages/AdminCitiesPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminSponsorsPage from "./pages/AdminSponsorsPage";
import AdminPopularServicesPage from "./pages/AdminPopularServicesPage";
import AdminFaqPage from "./pages/AdminFaqPage";
import AdminMetaTagsPage from "./pages/AdminMetaTagsPage";
import AdminJobsPage from "./pages/AdminJobsPage";
import PopularServicePage from "./pages/PopularServicePage";
import SeoPage from "./pages/SeoPage";
import CityPage from "./pages/CityPage";
import AboutPage from "./pages/AboutPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SitemapRedirect from "./pages/SitemapRedirect";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import FaqPage from "./pages/FaqPage";
import AdminHighlightsPage from "./pages/AdminHighlightsPage";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/buscar" element={<SearchPage />} />
            <Route path="/categoria/:slug" element={<CategoryPage />} />
            <Route path="/profissional/:slug" element={<ProviderProfile />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<SignupPage />} />
            <Route path="/vagas" element={<JobsPage />} />
            <Route path="/vaga/:slug" element={<JobDetailPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/perfil" element={<DashboardProfilePage />} />
            <Route path="/dashboard/servicos" element={<DashboardServicesPage />} />
            <Route path="/dashboard/avaliacoes" element={<DashboardReviewsPage />} />
            <Route path="/dashboard/leads" element={<DashboardLeadsPage />} />
            <Route path="/dashboard/plano" element={<DashboardPlanPage />} />
            <Route path="/dashboard/minha-pagina" element={<DashboardMyPagePage />} />
            <Route path="/dashboard/vagas" element={<DashboardJobsPage />} />
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
            <Route path="/admin/vagas" element={<AdminJobsPage />} />
            <Route path="/servico/:slug" element={<PopularServicePage />} />
            <Route path="/servico-detalhe/:id" element={<ServiceDetailPage />} />
            <Route path="/cidade/:slug" element={<CityPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/sobre" element={<AboutPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/sitemap" element={<SitemapRedirect />} />
            <Route path="/sitemap.xml" element={<SitemapRedirect />} />
            <Route path="/:slug" element={<SeoPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
