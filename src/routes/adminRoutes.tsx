/**
 * Admin routes — extraídas de src/App.tsx (PR 3 · split estrutural).
 * Comportamento idêntico: mesmo AdminGuard/RouteErrorBoundary/Navigate.
 * Sem nova lógica, sem mudança de paths.
 */
import { lazy as reactLazy, type ComponentType } from "react";
import { Route, Navigate } from "react-router-dom";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import ProtectedRoute from "@/components/ProtectedRoute";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

type LazyModule<T extends ComponentType<any>> = { default: T };
const lazy = <T extends ComponentType<any>>(importer: () => Promise<LazyModule<T>>) =>
  reactLazy(() => importWithRetry(importer));

const AdminPage = lazy(() => import("@/pages/AdminPage"));
const AdminProvidersPage = lazy(() => import("@/pages/AdminProvidersPage"));
const AdminDefaultNeighborhoodPage = lazy(() => import("@/pages/admin/AdminDefaultNeighborhoodPage"));
const AdminServiceAreaCorrectionsPage = lazy(() => import("@/pages/admin/AdminServiceAreaCorrectionsPage"));
const AdminKillSwitchBlocksPage = lazy(() => import("@/pages/admin/AdminKillSwitchBlocksPage"));
const AdminRegressionReportsPage = lazy(() => import("@/pages/admin/AdminRegressionReportsPage"));
const AdminAuthMetricsPage = lazy(() => import("@/pages/admin/AdminAuthMetricsPage"));
const AdminConsentRevocationsPage = lazy(() => import("@/pages/admin/AdminConsentRevocationsPage"));
const AdminIntegrityReportsPage = lazy(() => import("@/pages/admin/AdminIntegrityReportsPage"));
const AdminInboxPage = lazy(() => import("@/pages/admin/AdminInboxPage"));
const AdminSitemapAuditPage = lazy(() => import("@/pages/admin/AdminSitemapAuditPage"));
const AdminOnboardingStatsPage = lazy(() => import("@/pages/admin/AdminOnboardingStatsPage"));
const AdminOnboardingRegressionPage = lazy(() => import("@/pages/admin/AdminOnboardingRegressionPage"));
const AdminOnboardingOpsPage = lazy(() => import("@/pages/admin/AdminOnboardingOpsPage"));
const AdminAuthHealthPage = lazy(() => import("@/pages/admin/AdminAuthHealthPage"));
const AdminUploadStressTestPage = lazy(() => import("@/pages/admin/AdminUploadStressTestPage"));
const AdminSearchSortingPage = lazy(() => import("@/pages/admin/AdminSearchSortingPage"));
const AdminMetaTrackingQualityPage = lazy(() => import("@/pages/admin/AdminMetaTrackingQualityPage"));
const AdminDbPerformancePage = lazy(() => import("@/pages/admin/AdminDbPerformancePage"));
const AdminLoadTestsPage = lazy(() => import("@/pages/admin/AdminLoadTestsPage"));
const AdminReviewsPage = lazy(() => import("@/pages/AdminReviewsPage"));
const AdminUsersPage = lazy(() => import("@/pages/AdminUsersPage"));
const AdminCategoriesPage = lazy(() => import("@/pages/AdminCategoriesPage"));
const AdminStatsPage = lazy(() => import("@/pages/AdminStatsPage"));
const AdminCitiesPage = lazy(() => import("@/pages/AdminCitiesPage"));
const AdminSettingsPage = lazy(() => import("@/pages/AdminSettingsPage"));
const AdminSponsorsPage = lazy(() => import("@/pages/AdminSponsorsPage"));
const AdminPublicFunnelPage = lazy(() => import("@/pages/AdminPublicFunnelPage"));
const AdminSponsorChangeRequestsPage = lazy(() => import("@/pages/AdminSponsorChangeRequestsPage"));
const AdminSponsorBillingPage = lazy(() => import("@/pages/AdminSponsorBillingPage"));
const AdminProviderConversionPage = lazy(() => import("@/pages/AdminProviderConversionPage"));
const AdminSeoLandingsPage = lazy(() => import("@/pages/admin/AdminSeoLandingsPage"));
const AdminSeoRuntimeMetricsPage = lazy(() => import("@/pages/admin/AdminSeoRuntimeMetricsPage"));
const AdminPublicFunnelHealthPage = lazy(() => import("@/pages/admin/AdminPublicFunnelHealthPage"));
// ETAPA 10 — Hubs com sub-tabs (SEO + Onboarding Ops)
const AdminSeoPage = lazy(() => import("@/pages/admin/AdminSeoPage"));
const AdminOnboardingHubPage = lazy(() => import("@/pages/admin/AdminOnboardingHubPage"));
const AdminSponsorApprovalsPage = lazy(() => import("@/pages/AdminSponsorApprovalsPage"));
const AdminPopularServicesPage = lazy(() => import("@/pages/AdminPopularServicesPage"));
const AdminFaqPage = lazy(() => import("@/pages/AdminFaqPage"));
const AdminMetaTagsPage = lazy(() => import("@/pages/AdminMetaTagsPage"));
const AdminJobsPage = lazy(() => import("@/pages/AdminJobsPage"));
const AdminJobsImportPage = lazy(() => import("@/pages/AdminJobsImportPage"));
const AdminHighlightsPage = lazy(() => import("@/pages/AdminHighlightsPage"));
const AdminCommunityPage = lazy(() => import("@/pages/AdminCommunityPage"));
const AdminBlogPage = lazy(() => import("@/pages/AdminBlogPage"));
const AdminSponsorCrmPage = lazy(() => import("@/pages/AdminSponsorCrmPage"));
const AdminAdSlotsPage = lazy(() => import("@/pages/AdminAdSlotsPage"));
const AdminAuditLogPage = lazy(() => import("@/pages/AdminAuditLogPage"));
const AdminAuditRefPage = lazy(() => import("@/pages/AdminAuditRefPage"));
const AdminAuditRlsPage = lazy(() => import("@/pages/AdminAuditRlsPage"));
const AdminTrashPage = lazy(() => import("@/pages/AdminTrashPage"));
const AdminBackupPage = lazy(() => import("@/pages/AdminBackupPage"));
const AdminPortabilityPage = lazy(() => import("@/pages/AdminPortabilityPage"));
const AdminPortabilityDetailsPage = lazy(() => import("@/pages/AdminPortabilityDetailsPage"));
const AdminHeroBannersPage = lazy(() => import("@/pages/AdminHeroBannersPage"));
const AdminPwaPage = lazy(() => import("@/pages/AdminPwaPage"));
const AdminMediaPage = lazy(() => import("@/pages/AdminMediaPage"));
const AdminServicesPage = lazy(() => import("@/pages/AdminServicesPage"));
const AdminLeadsPage = lazy(() => import("@/pages/AdminLeadsPage"));
const AdminModulesPage = lazy(() => import("@/pages/AdminModulesPage"));
const AdminBlocksPage = lazy(() => import("@/pages/AdminBlocksPage"));
const AdminInstitutionalPagesPage = lazy(() => import("@/pages/AdminInstitutionalPagesPage"));
const AdminMenuPage = lazy(() => import("@/pages/AdminMenuPage"));
const AdminHomeStepsPage = lazy(() => import("@/pages/AdminHomeStepsPage"));
const AdminTestimonialsPage = lazy(() => import("@/pages/AdminTestimonialsPage"));
const AdminCtaBlocksPage = lazy(() => import("@/pages/AdminCtaBlocksPage"));
const AdminHomeSectionsPage = lazy(() => import("@/pages/AdminHomeSectionsPage"));
const AdminUsersCrmPage = lazy(() => import("@/pages/AdminUsersCrmPage"));
const AdminBoostsPage = lazy(() => import("@/pages/AdminBoostsPage"));
const AdminBottomNavPage = lazy(() => import("@/pages/AdminBottomNavPage"));
const AdminSponsorLeadsPage = lazy(() => import("@/pages/AdminSponsorLeadsPage"));
const AdminSponsorDocsHistoryPage = lazy(() => import("@/pages/AdminSponsorDocsHistoryPage"));
const AdminGamificationPage = lazy(() => import("@/pages/AdminGamificationPage"));
const AdminRankingsPage = lazy(() => import("@/pages/AdminRankingsPage"));
const AdminCoverageMapPage = lazy(() => import("@/pages/AdminCoverageMapPage"));
const AdminSeoAuditPage = lazy(() => import("@/pages/AdminSeoAuditPage"));
const AdminLocationDebugPage = lazy(() => import("@/pages/AdminLocationDebugPage"));
const AdminLocationSeoAuditPage = lazy(() => import("@/pages/AdminLocationSeoAuditPage"));
const AdminSearchAuditPage = lazy(() => import("@/pages/AdminSearchAuditPage"));
const AdminHomeRotationPage = lazy(() => import("@/pages/AdminHomeRotationPage"));
const AdminWizardDiagnosticsPage = lazy(() => import("@/pages/AdminWizardDiagnosticsPage"));
const AdminOverviewPage = lazy(() => import("@/pages/AdminOverviewPage"));
const AdminNotificationsPage = lazy(() => import("@/pages/AdminNotificationsPage"));
const AdminChatPage = lazy(() => import("@/pages/AdminChatPage"));
const AdminGovernancePage = lazy(() => import("@/pages/AdminGovernancePage"));
const AdminSystemHealthPage = lazy(() => import("@/pages/AdminSystemHealthPage"));
const AdminPermissionsPage = lazy(() => import("@/pages/AdminPermissionsPage"));
const AdminStaffPage = lazy(() => import("@/pages/AdminStaffPage"));
const AdminApprovalSettingsPage = lazy(() => import("@/pages/AdminApprovalSettingsPage"));
const AdminOrphanProfilesPage = lazy(() => import("@/pages/AdminOrphanProfilesPage"));
const AdminConversionMetricsPage = lazy(() => import("@/pages/AdminConversionMetricsPage"));
const AdminOnboardingFunnelPage = lazy(() => import("@/pages/AdminOnboardingFunnelPage"));
const AdminError500Page = lazy(() => import("@/pages/AdminError500Page"));
const AdminBrokenLinksPage = lazy(() => import("@/pages/admin/AdminBrokenLinksPage"));
const AdminCoursesPage = lazy(() => import("@/pages/AdminCoursesPage"));
const AdminNeighborhoodsCrudPage = lazy(() => import("@/pages/admin/AdminNeighborhoodsCrudPage"));
const AdminSponsorSlotLimitsPage = lazy(() => import("@/pages/admin/AdminSponsorSlotLimitsPage"));
const AdminSubscriptionsPage = lazy(() => import("@/pages/admin/AdminSubscriptionsPage"));
const AdminDashboardLayoutPage = lazy(() => import("@/pages/admin/AdminDashboardLayoutPage"));

export const adminRoutes = (
  <>
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
    {/* ETAPA 10 — Onboarding Ops Hub (umbrella com sub-tabs) */}
    <Route path="/admin/onboarding-ops" element={<AdminGuard><RouteErrorBoundary sectionName="AdminOnboardingHubPage"><AdminOnboardingHubPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/onboarding-ops/:tab" element={<AdminGuard><RouteErrorBoundary sectionName="AdminOnboardingHubPage"><AdminOnboardingHubPage /></RouteErrorBoundary></AdminGuard>} />
    {/* Aliases legados — redirecionam para a tab correta no hub */}
    <Route path="/admin/onboarding-funnel" element={<Navigate to="/admin/onboarding-ops/funnel" replace />} />
    <Route path="/admin/onboarding-stats" element={<Navigate to="/admin/onboarding-ops/stats" replace />} />
    <Route path="/admin/onboarding-regression" element={<Navigate to="/admin/onboarding-ops/regression" replace />} />
    <Route path="/admin/wizard-diagnostico" element={<Navigate to="/admin/onboarding-ops/wizard-debug" replace />} />
    <Route path="/admin/health-check" element={<AdminGuard><RouteErrorBoundary sectionName="AdminAuthHealthPage"><AdminAuthHealthPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/integridade" element={<AdminGuard><RouteErrorBoundary sectionName="AdminIntegrityReportsPage"><AdminIntegrityReportsPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/upload-stress-test" element={<AdminGuard><RouteErrorBoundary sectionName="AdminUploadStressTestPage"><AdminUploadStressTestPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/db-performance" element={<AdminGuard><RouteErrorBoundary sectionName="AdminDbPerformancePage"><AdminDbPerformancePage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/load-tests" element={<AdminGuard><RouteErrorBoundary sectionName="AdminLoadTestsPage"><AdminLoadTestsPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/caixa-notificacoes" element={<AdminGuard><RouteErrorBoundary sectionName="AdminInboxPage"><AdminInboxPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/sitemap-audit" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSitemapAuditPage"><AdminSitemapAuditPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/busca-ordenacao" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSearchSortingPage"><AdminSearchSortingPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/meta-tracking-quality" element={<AdminGuard><RouteErrorBoundary sectionName="AdminMetaTrackingQualityPage"><AdminMetaTrackingQualityPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/erros-500" element={<AdminError500Page />} />
    <Route path="/admin/links-quebrados" element={<AdminGuard><RouteErrorBoundary sectionName="AdminBrokenLinksPage"><AdminBrokenLinksPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/cidades" element={<AdminCitiesPage />} />
    <Route path="/admin/configuracoes" element={<AdminSettingsPage />} />
    <Route path="/admin/patrocinadores" element={<AdminSponsorsPage />} />
    <Route path="/admin/funil-publico" element={<AdminGuard><RouteErrorBoundary sectionName="AdminPublicFunnelPage"><AdminPublicFunnelPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/sponsor-change-requests" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorChangeRequestsPage"><AdminSponsorChangeRequestsPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/sponsor-billing" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorBillingPage"><AdminSponsorBillingPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/provider-conversion" element={<AdminGuard><RouteErrorBoundary sectionName="AdminProviderConversionPage"><AdminProviderConversionPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/seo-landings" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSeoLandingsPage"><AdminSeoLandingsPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/seo-runtime" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSeoRuntimeMetricsPage"><AdminSeoRuntimeMetricsPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/funil-health" element={<AdminGuard><RouteErrorBoundary sectionName="AdminPublicFunnelHealthPage"><AdminPublicFunnelHealthPage /></RouteErrorBoundary></AdminGuard>} />
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
    <Route path="/admin/onboarding" element={<Navigate to="/admin/wizard-diagnostico" replace />} />
    <Route path="/admin/perfis-orfaos" element={<AdminOrphanProfilesPage />} />
    <Route path="/admin/cursos" element={<AdminCoursesPage />} />
    <Route path="/admin/neighborhoods" element={<AdminGuard><RouteErrorBoundary sectionName="AdminNeighborhoodsCrudPage"><AdminNeighborhoodsCrudPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/sponsor-slot-limits" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorSlotLimitsPage"><AdminSponsorSlotLimitsPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/subscriptions" element={<AdminGuard><RouteErrorBoundary sectionName="AdminSubscriptionsPage"><AdminSubscriptionsPage /></RouteErrorBoundary></AdminGuard>} />
    <Route path="/admin/dashboard-layout" element={<AdminGuard><RouteErrorBoundary sectionName="AdminDashboardLayoutPage"><AdminDashboardLayoutPage /></RouteErrorBoundary></AdminGuard>} />
  </>
);
