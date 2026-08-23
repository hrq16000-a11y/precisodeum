import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";
import SponsorFeatureGate from "@/components/sponsor/SponsorFeatureGate";

const SponsorMetricsPage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorMetricsPage")));

export const Route = createFileRoute("/sponsor-panel/metricas")({
  component: () => (<SponsorProtectedRoute><SponsorFeatureGate feature="metricas"><SponsorMetricsPage /></SponsorFeatureGate></SponsorProtectedRoute>),
});
