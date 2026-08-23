import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";
import SponsorFeatureGate from "@/components/sponsor/SponsorFeatureGate";

const SponsorCampaignsPage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorCampaignsPage")));

export const Route = createFileRoute("/sponsor-panel/campanhas")({
  component: () => (<SponsorProtectedRoute><SponsorFeatureGate feature="campanhas"><SponsorCampaignsPage /></SponsorFeatureGate></SponsorProtectedRoute>),
});
