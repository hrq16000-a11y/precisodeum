/**
 * Sponsor Panel routes — extraídas de src/App.tsx (PR 3 · split estrutural).
 * Comportamento idêntico: SponsorProtectedRoute + SponsorFeatureGate
 * mantidos exatamente como no original.
 */
import { lazy as reactLazy, type ComponentType } from "react";
import { Route } from "react-router-dom";
import { importWithRetry } from "@/lib/lazyWithRetry";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

type LazyModule<T extends ComponentType<any>> = { default: T };
const lazy = <T extends ComponentType<any>>(importer: () => Promise<LazyModule<T>>) =>
  reactLazy(() => importWithRetry(importer));

const SponsorProtectedRoute = reactLazy(() => importWithRetry(() => import("@/components/SponsorProtectedRoute")));
const SponsorFeatureGate = reactLazy(() => importWithRetry(() => import("@/components/sponsor/SponsorFeatureGate")));

const SponsorDashboardPage = lazy(() => import("@/pages/sponsor/SponsorDashboardPage"));
const SponsorBannersPage = lazy(() => import("@/pages/sponsor/SponsorBannersPage"));
const SponsorCampaignsPage = lazy(() => import("@/pages/sponsor/SponsorCampaignsPage"));
const SponsorMetricsPage = lazy(() => import("@/pages/sponsor/SponsorMetricsPage"));
const SponsorContractsPage = lazy(() => import("@/pages/sponsor/SponsorContractsPage"));
const SponsorNotificationsPage = lazy(() => import("@/pages/sponsor/SponsorNotificationsPage"));
const SponsorDataPage = lazy(() => import("@/pages/sponsor/SponsorDataPage"));
const SponsorSubscriptionPage = lazy(() => import("@/pages/sponsor/SponsorSubscriptionPage"));
const SponsorSelfServicePage = lazy(() => import("@/pages/sponsor/SponsorSelfServicePage"));
const SponsorBillingPage = lazy(() => import("@/pages/sponsor/SponsorBillingPage"));
const SponsorPublicProfilePage = lazy(() => import("@/pages/sponsor/SponsorPublicProfilePage"));

export const sponsorRoutes = (
  <>
    <Route path="/sponsor-panel" element={<SponsorProtectedRoute><SponsorDashboardPage /></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/banners" element={<SponsorProtectedRoute><SponsorFeatureGate feature="banners"><SponsorBannersPage /></SponsorFeatureGate></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/editar" element={<SponsorProtectedRoute><RouteErrorBoundary sectionName="SponsorSelfServicePage"><SponsorSelfServicePage /></RouteErrorBoundary></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/campanhas" element={<SponsorProtectedRoute><SponsorFeatureGate feature="campanhas"><SponsorCampaignsPage /></SponsorFeatureGate></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/metricas" element={<SponsorProtectedRoute><SponsorFeatureGate feature="metricas"><SponsorMetricsPage /></SponsorFeatureGate></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/contratos" element={<SponsorProtectedRoute><SponsorContractsPage /></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/notificacoes" element={<SponsorProtectedRoute><SponsorNotificationsPage /></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/dados" element={<SponsorProtectedRoute><SponsorDataPage /></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/pagina" element={<SponsorProtectedRoute><SponsorFeatureGate><SponsorPublicProfilePage /></SponsorFeatureGate></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/assinatura" element={<SponsorProtectedRoute><SponsorSubscriptionPage /></SponsorProtectedRoute>} />
    <Route path="/sponsor-panel/faturamento" element={<SponsorProtectedRoute><RouteErrorBoundary sectionName="SponsorBillingPage"><SponsorBillingPage /></RouteErrorBoundary></SponsorProtectedRoute>} />
  </>
);
