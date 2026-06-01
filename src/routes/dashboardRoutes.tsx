/**
 * Dashboard routes — extraídas de src/App.tsx (PR 3 · split estrutural).
 * Comportamento idêntico ao original: mesmas paths, mesmos guards
 * (ProtectedRoute/ErrorGuard), mesma lazy strategy. Nenhuma lógica nova.
 */
import { lazy as reactLazy, type ComponentType } from "react";
import { Route } from "react-router-dom";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorGuard from "@/components/ErrorGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import DashboardRouteGuard from "@/components/dashboard/DashboardRouteGuard";

type LazyModule<T extends ComponentType<any>> = { default: T };
const lazy = <T extends ComponentType<any>>(importer: () => Promise<LazyModule<T>>) =>
  reactLazy(() => importWithRetry(importer));

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const DashboardProfilePage = lazy(() => import("@/pages/DashboardProfilePage"));
const DashboardServicesPage = lazy(() => import("@/pages/DashboardServicesPage"));
const DashboardOnboardingStatusPage = lazy(() => import("@/pages/DashboardOnboardingStatusPage"));
const DashboardBadgeAuditPage = lazy(() => import("@/pages/DashboardBadgeAuditPage"));
const DashboardLocationGuidedPage = lazy(() => import("@/pages/DashboardLocationGuidedPage"));
const DashboardReviewsPage = lazy(() => import("@/pages/DashboardReviewsPage"));
const DashboardLeadsPage = lazy(() => import("@/pages/DashboardLeadsPage"));
const DashboardLeadDetailPage = lazy(() => import("@/pages/DashboardLeadDetailPage"));
const DashboardNotificationPreferencesPage = lazy(() => import("@/pages/DashboardNotificationPreferencesPage"));
const DashboardMetricsPage = lazy(() => import("@/pages/DashboardMetricsPage"));
const DashboardOpenLeadsPage = lazy(() => import("@/pages/DashboardOpenLeadsPage"));
const DashboardPlanPage = lazy(() => import("@/pages/DashboardPlanPage"));
const DashboardMyPagePage = lazy(() => import("@/pages/DashboardMyPagePage"));
const DashboardJobsPage = lazy(() => import("@/pages/DashboardJobsPage"));
const DashboardAgencyDataPage = lazy(() => import("@/pages/DashboardAgencyDataPage"));
const DashboardCompanyDataPage = lazy(() => import("@/pages/DashboardCompanyDataPage"));
const DashboardCommunityPage = lazy(() => import("@/pages/DashboardCommunityPage"));
const DashboardNotificationsPage = lazy(() => import("@/pages/DashboardNotificationsPage"));
const DashboardPrivacyPage = lazy(() => import("@/pages/DashboardPrivacyPage"));
const DashboardConsentAuditPage = lazy(() => import("@/pages/DashboardConsentAuditPage"));
const DashboardMyRegistrationPage = lazy(() => import("@/pages/DashboardMyRegistrationPage"));
const DashboardCadastroStatusPage = lazy(() => import("@/pages/DashboardCadastroStatusPage"));
const DashboardAssistantPage = lazy(() => import("@/pages/DashboardAssistantPage"));
const DashboardReferralsPage = lazy(() => import("@/pages/DashboardReferralsPage"));
const DashboardRankingPage = lazy(() => import("@/pages/DashboardRankingPage"));
const DashboardIdentitySuggestionsPage = lazy(() => import("@/pages/DashboardIdentitySuggestionsPage"));
const DashboardChatPage = lazy(() => import("@/pages/DashboardChatPage"));
const DashboardSupportPage = lazy(() => import("@/pages/DashboardSupportPage"));
const DashboardClientContactsPage = lazy(() => import("@/pages/DashboardClientContactsPage"));
const DashboardPortfolioPage = lazy(() => import("@/pages/DashboardPortfolioPage"));
const OnboardingV2SuccessPage = lazy(() => import("@/pages/OnboardingV2SuccessPage"));

export const dashboardRoutes = (
  <>
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
    <Route path="/dashboard/cliente/contatos" element={<ProtectedRoute><DashboardClientContactsPage /></ProtectedRoute>} />
  </>
);
