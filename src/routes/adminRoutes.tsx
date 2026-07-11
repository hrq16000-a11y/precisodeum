/**
 * Admin routes — extraídas de src/App.tsx (PR 3 · split estrutural).
 *
 * BLINDAGEM (Onda 2): TODAS as rotas /admin/* passam por AdminGuard
 * via helper `guarded()`. AdminGuard valida server-side (RPC has_role)
 * e redireciona não-admins para /dashboard com toast "Acesso restrito".
 * Rotas legadas que usavam ProtectedRoute também foram promovidas a
 * AdminGuard. Rotas <Navigate /> são apenas redirects e não precisam
 * de guard (o destino tem).
 */
import { lazy as reactLazy, type ComponentType, type ReactElement } from "react";
import { Route, Navigate } from "react-router-dom";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

type LazyModule<T extends ComponentType<any>> = { default: T };
const lazy = <T extends ComponentType<any>>(importer: () => Promise<LazyModule<T>>) =>
  reactLazy(() => importWithRetry(importer));

/** Envelopa um elemento de página com AdminGuard + RouteErrorBoundary. */
const guarded = (sectionName: string, element: ReactElement): ReactElement => (
  <AdminGuard>
    <RouteErrorBoundary sectionName={sectionName}>{element}</RouteErrorBoundary>
  </AdminGuard>
);

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
const AdminOnboardingStatsPage = lazy(() => import("@/pages/admin/AdminOnboardingStatsPage"));
const AdminOnboardingRegressionPage = lazy(() => import("@/pages/admin/AdminOnboardingRegressionPage"));
const AdminOnboardingOpsPage = lazy(() => import("@/pages/admin/AdminOnboardingOpsPage"));
const AdminAuthHealthPage = lazy(() => import("@/pages/admin/AdminAuthHealthPage"));
const AdminUploadStressTestPage = lazy(() => import("@/pages/admin/AdminUploadStressTestPage"));
const AdminSearchSortingPage = lazy(() => import("@/pages/admin/AdminSearchSortingPage"));
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
const AdminPublicFunnelHealthPage = lazy(() => import("@/pages/admin/AdminPublicFunnelHealthPage"));
const AdminSeoPage = lazy(() => import("@/pages/admin/AdminSeoPage"));
const AdminOnboardingHubPage = lazy(() => import("@/pages/admin/AdminOnboardingHubPage"));
const AdminSponsorApprovalsPage = lazy(() => import("@/pages/AdminSponsorApprovalsPage"));
const AdminSecurityFindingsPage = lazy(() => import("@/pages/admin/AdminSecurityFindingsPage"));
const AdminPopularServicesPage = lazy(() => import("@/pages/AdminPopularServicesPage"));
const AdminFaqPage = lazy(() => import("@/pages/AdminFaqPage"));
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
const AdminLocalizacoesPage = lazy(() => import("@/pages/AdminLocalizacoesPage"));
const AdminSearchAuditPage = lazy(() => import("@/pages/AdminSearchAuditPage"));
const AdminHomeRotationPage = lazy(() => import("@/pages/AdminHomeRotationPage"));
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
const AdminError500Page = lazy(() => import("@/pages/AdminError500Page"));
const AdminErrorReportsPage = lazy(() => import("@/pages/admin/AdminErrorReportsPage"));
const AdminCoursesPage = lazy(() => import("@/pages/AdminCoursesPage"));
const AdminNeighborhoodsCrudPage = lazy(() => import("@/pages/admin/AdminNeighborhoodsCrudPage"));
const AdminSponsorSlotLimitsPage = lazy(() => import("@/pages/admin/AdminSponsorSlotLimitsPage"));
const AdminSubscriptionsPage = lazy(() => import("@/pages/admin/AdminSubscriptionsPage"));
const AdminDashboardLayoutPage = lazy(() => import("@/pages/admin/AdminDashboardLayoutPage"));
const AdminSponsorPlansPage = lazy(() => import("@/pages/admin/AdminSponsorPlansPage"));
const AdminSponsorCampaignsPage = lazy(() => import("@/pages/admin/AdminSponsorCampaignsPage"));
const AdminSponsorContractsPage = lazy(() => import("@/pages/admin/AdminSponsorContractsPage"));
const AdminSponsorDocsAuditPage = lazy(() => import("@/pages/admin/AdminSponsorDocsAuditPage"));

export const adminRoutes = (
  <>
    <Route path="/admin" element={guarded("AdminPage", <AdminPage />)} />
    <Route path="/admin/prestadores" element={guarded("AdminProvidersPage", <AdminProvidersPage />)} />
    <Route path="/admin/bairro-default" element={guarded("AdminDefaultNeighborhoodPage", <AdminDefaultNeighborhoodPage />)} />
    <Route path="/admin/localizacoes" element={guarded("AdminLocalizacoesPage", <AdminLocalizacoesPage />)} />
    <Route path="/admin/service-area-corrections" element={guarded("AdminServiceAreaCorrectionsPage", <AdminServiceAreaCorrectionsPage />)} />
    <Route path="/admin/kill-switch-blocks" element={guarded("AdminKillSwitchBlocksPage", <AdminKillSwitchBlocksPage />)} />
    <Route path="/admin/avaliacoes" element={guarded("AdminReviewsPage", <AdminReviewsPage />)} />
    <Route path="/admin/usuarios" element={guarded("AdminUsersPage", <AdminUsersPage />)} />
    <Route path="/admin/crm-usuarios" element={guarded("AdminUsersCrmPage", <AdminUsersCrmPage />)} />
    <Route path="/admin/categorias" element={guarded("AdminCategoriesPage", <AdminCategoriesPage />)} />
    <Route path="/admin/estatisticas" element={guarded("AdminStatsPage", <AdminStatsPage />)} />
    <Route path="/admin/conversao" element={guarded("AdminConversionMetricsPage", <AdminConversionMetricsPage />)} />
    <Route path="/admin/onboarding-ops" element={guarded("AdminOnboardingHubPage", <AdminOnboardingHubPage />)} />
    <Route path="/admin/onboarding-ops/:tab" element={guarded("AdminOnboardingHubPage", <AdminOnboardingHubPage />)} />
    <Route path="/admin/onboarding-funnel" element={<Navigate to="/admin/onboarding-ops/funnel" replace />} />
    <Route path="/admin/onboarding-stats" element={<Navigate to="/admin/onboarding-ops/stats" replace />} />
    <Route path="/admin/onboarding-regression" element={<Navigate to="/admin/onboarding-ops/regression" replace />} />
    <Route path="/admin/wizard-diagnostico" element={<Navigate to="/admin/onboarding-ops/wizard-debug" replace />} />
    <Route path="/admin/health-check" element={guarded("AdminAuthHealthPage", <AdminAuthHealthPage />)} />
    <Route path="/admin/integridade" element={guarded("AdminIntegrityReportsPage", <AdminIntegrityReportsPage />)} />
    <Route path="/admin/upload-stress-test" element={guarded("AdminUploadStressTestPage", <AdminUploadStressTestPage />)} />
    <Route path="/admin/db-performance" element={guarded("AdminDbPerformancePage", <AdminDbPerformancePage />)} />
    <Route path="/admin/load-tests" element={guarded("AdminLoadTestsPage", <AdminLoadTestsPage />)} />
    <Route path="/admin/caixa-notificacoes" element={guarded("AdminInboxPage", <AdminInboxPage />)} />
    <Route path="/admin/sitemap-audit" element={<Navigate to="/admin/seo/sitemap" replace />} />
    <Route path="/admin/busca-ordenacao" element={guarded("AdminSearchSortingPage", <AdminSearchSortingPage />)} />
    <Route path="/admin/meta-tracking-quality" element={<Navigate to="/admin/seo/meta-tracking" replace />} />
    <Route path="/admin/erros-500" element={guarded("AdminError500Page", <AdminError500Page />)} />
    <Route path="/admin/erros" element={guarded("AdminErrorReportsPage", <AdminErrorReportsPage />)} />
    <Route path="/admin/links-quebrados" element={<Navigate to="/admin/seo/broken-links" replace />} />
    <Route path="/admin/seo" element={guarded("AdminSeoPage", <AdminSeoPage />)} />
    <Route path="/admin/seo/:tab" element={guarded("AdminSeoPage", <AdminSeoPage />)} />
    <Route path="/admin/cidades" element={guarded("AdminCitiesPage", <AdminCitiesPage />)} />
    <Route path="/admin/configuracoes" element={guarded("AdminSettingsPage", <AdminSettingsPage />)} />
    <Route path="/admin/patrocinadores" element={guarded("AdminSponsorsPage", <AdminSponsorsPage />)} />
    <Route path="/admin/funil-publico" element={guarded("AdminPublicFunnelPage", <AdminPublicFunnelPage />)} />
    <Route path="/admin/sponsor-change-requests" element={guarded("AdminSponsorChangeRequestsPage", <AdminSponsorChangeRequestsPage />)} />
    <Route path="/admin/sponsor-billing" element={guarded("AdminSponsorBillingPage", <AdminSponsorBillingPage />)} />
    <Route path="/admin/provider-conversion" element={guarded("AdminProviderConversionPage", <AdminProviderConversionPage />)} />
    <Route path="/admin/seo-landings" element={<Navigate to="/admin/seo/landings" replace />} />
    <Route path="/admin/seo-runtime" element={<Navigate to="/admin/seo/runtime" replace />} />
    <Route path="/admin/funil-health" element={guarded("AdminPublicFunnelHealthPage", <AdminPublicFunnelHealthPage />)} />
    <Route path="/admin/patrocinadores/aprovacoes" element={guarded("AdminSponsorApprovalsPage", <AdminSponsorApprovalsPage />)} />
    <Route path="/admin/servicos-populares" element={guarded("AdminPopularServicesPage", <AdminPopularServicesPage />)} />
    <Route path="/admin/faq" element={guarded("AdminFaqPage", <AdminFaqPage />)} />
    <Route path="/admin/metatags" element={<Navigate to="/admin/seo/metatags" replace />} />
    <Route path="/admin/destaques" element={guarded("AdminHighlightsPage", <AdminHighlightsPage />)} />
    <Route path="/admin/comunidade" element={guarded("AdminCommunityPage", <AdminCommunityPage />)} />
    <Route path="/admin/vagas" element={guarded("AdminJobsPage", <AdminJobsPage />)} />
    <Route path="/admin/vagas/importar" element={guarded("AdminJobsImportPage", <AdminJobsImportPage />)} />
    <Route path="/admin/blog" element={guarded("AdminBlogPage", <AdminBlogPage />)} />
    <Route path="/admin/crm-patrocinadores" element={guarded("AdminSponsorCrmPage", <AdminSponsorCrmPage />)} />
    <Route path="/admin/slots-anuncios" element={guarded("AdminAdSlotsPage", <AdminAdSlotsPage />)} />
    <Route path="/admin/auditoria" element={guarded("AdminAuditLogPage", <AdminAuditLogPage />)} />
    <Route path="/admin/auditoria-ref" element={guarded("AdminAuditRefPage", <AdminAuditRefPage />)} />
    <Route path="/admin/auditoria-rls" element={guarded("AdminAuditRlsPage", <AdminAuditRlsPage />)} />
    <Route path="/admin/backup" element={guarded("AdminBackupPage", <AdminBackupPage />)} />
    <Route path="/admin/portabilidade" element={guarded("AdminPortabilityPage", <AdminPortabilityPage />)} />
    <Route path="/admin/portabilidade/detalhes" element={guarded("AdminPortabilityDetailsPage", <AdminPortabilityDetailsPage />)} />
    <Route path="/admin/lixeira" element={guarded("AdminTrashPage", <AdminTrashPage />)} />
    <Route path="/admin/hero-banners" element={guarded("AdminHeroBannersPage", <AdminHeroBannersPage />)} />
    <Route path="/admin/pwa" element={guarded("AdminPwaPage", <AdminPwaPage />)} />
    <Route path="/admin/regressao" element={guarded("AdminRegressionReportsPage", <AdminRegressionReportsPage />)} />
    <Route path="/admin/metricas-auth" element={guarded("AdminAuthMetricsPage", <AdminAuthMetricsPage />)} />
    <Route path="/admin/consent-revocations" element={guarded("AdminConsentRevocationsPage", <AdminConsentRevocationsPage />)} />
    <Route path="/admin/midia" element={guarded("AdminMediaPage", <AdminMediaPage />)} />
    <Route path="/admin/servicos" element={guarded("AdminServicesPage", <AdminServicesPage />)} />
    <Route path="/admin/leads" element={guarded("AdminLeadsPage", <AdminLeadsPage />)} />
    <Route path="/admin/modulos" element={guarded("AdminModulesPage", <AdminModulesPage />)} />
    <Route path="/admin/blocos" element={guarded("AdminBlocksPage", <AdminBlocksPage />)} />
    <Route path="/admin/paginas" element={guarded("AdminInstitutionalPagesPage", <AdminInstitutionalPagesPage />)} />
    <Route path="/admin/menus" element={guarded("AdminMenuPage", <AdminMenuPage />)} />
    <Route path="/admin/como-funciona" element={guarded("AdminHomeStepsPage", <AdminHomeStepsPage />)} />
    <Route path="/admin/home-rotacao" element={guarded("AdminHomeRotationPage", <AdminHomeRotationPage />)} />
    <Route path="/admin/depoimentos" element={guarded("AdminTestimonialsPage", <AdminTestimonialsPage />)} />
    <Route path="/admin/cta-blocos" element={guarded("AdminCtaBlocksPage", <AdminCtaBlocksPage />)} />
    <Route path="/admin/secoes-home" element={guarded("AdminHomeSectionsPage", <AdminHomeSectionsPage />)} />
    <Route path="/admin/leads-patrocinadores" element={guarded("AdminSponsorLeadsPage", <AdminSponsorLeadsPage />)} />
    <Route path="/admin/sponsor-docs-historico" element={guarded("AdminSponsorDocsHistoryPage", <AdminSponsorDocsHistoryPage />)} />
    <Route path="/admin/overview" element={guarded("AdminOverviewPage", <AdminOverviewPage />)} />
    <Route path="/admin/notificacoes" element={guarded("AdminNotificationsPage", <AdminNotificationsPage />)} />
    <Route path="/admin/chat" element={guarded("AdminChatPage", <AdminChatPage />)} />
    <Route path="/admin/boosts" element={guarded("AdminBoostsPage", <AdminBoostsPage />)} />
    <Route path="/admin/barra-inferior" element={guarded("AdminBottomNavPage", <AdminBottomNavPage />)} />
    <Route path="/admin/governanca" element={guarded("AdminGovernancePage", <AdminGovernancePage />)} />
    <Route path="/admin/sistema/saude" element={guarded("AdminSystemHealthPage", <AdminSystemHealthPage />)} />
    <Route path="/admin/sistema/permissoes" element={guarded("AdminPermissionsPage", <AdminPermissionsPage />)} />
    <Route path="/admin/permissoes" element={<Navigate to="/admin/sistema/permissoes" replace />} />
    <Route path="/admin/gamificacao" element={guarded("AdminGamificationPage", <AdminGamificationPage />)} />
    <Route path="/admin/rankings" element={guarded("AdminRankingsPage", <AdminRankingsPage />)} />
    <Route path="/admin/cobertura" element={guarded("AdminCoverageMapPage", <AdminCoverageMapPage />)} />
    <Route path="/admin/seo-auditoria" element={guarded("AdminSeoAuditPage", <AdminSeoAuditPage />)} />
    <Route path="/admin/debug-localizacao" element={guarded("AdminLocationDebugPage", <AdminLocationDebugPage />)} />
    <Route path="/admin/auditoria-cidade-uf" element={guarded("AdminLocationSeoAuditPage", <AdminLocationSeoAuditPage />)} />
    <Route path="/admin/busca-auditoria" element={guarded("AdminSearchAuditPage", <AdminSearchAuditPage />)} />
    <Route path="/admin/staff" element={guarded("AdminStaffPage", <AdminStaffPage />)} />
    <Route path="/admin/aprovacao" element={guarded("AdminApprovalSettingsPage", <AdminApprovalSettingsPage />)} />
    <Route path="/admin/onboarding" element={<Navigate to="/admin/wizard-diagnostico" replace />} />
    <Route path="/admin/perfis-orfaos" element={guarded("AdminOrphanProfilesPage", <AdminOrphanProfilesPage />)} />
    <Route path="/admin/cursos" element={guarded("AdminCoursesPage", <AdminCoursesPage />)} />
    <Route path="/admin/neighborhoods" element={guarded("AdminNeighborhoodsCrudPage", <AdminNeighborhoodsCrudPage />)} />
    <Route path="/admin/sponsor-slot-limits" element={guarded("AdminSponsorSlotLimitsPage", <AdminSponsorSlotLimitsPage />)} />
    <Route path="/admin/subscriptions" element={guarded("AdminSubscriptionsPage", <AdminSubscriptionsPage />)} />
    <Route path="/admin/dashboard-layout" element={guarded("AdminDashboardLayoutPage", <AdminDashboardLayoutPage />)} />
    <Route path="/admin/sponsor-plans" element={guarded("AdminSponsorPlansPage", <AdminSponsorPlansPage />)} />
    <Route path="/admin/sponsor-campaigns" element={guarded("AdminSponsorCampaignsPage", <AdminSponsorCampaignsPage />)} />
    <Route path="/admin/sponsor-contracts" element={guarded("AdminSponsorContractsPage", <AdminSponsorContractsPage />)} />
    <Route path="/admin/security-findings" element={guarded("AdminSecurityFindingsPage", <AdminSecurityFindingsPage />)} />
    <Route path="/admin/sponsor-docs-audit" element={guarded("AdminSponsorDocsAuditPage", <AdminSponsorDocsAuditPage />)} />
  </>
);
