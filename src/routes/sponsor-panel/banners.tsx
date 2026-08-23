import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";
import SponsorFeatureGate from "@/components/sponsor/SponsorFeatureGate";

const SponsorBannersPage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorBannersPage")));

export const Route = createFileRoute("/sponsor-panel/banners")({
  component: () => (<SponsorProtectedRoute><SponsorFeatureGate feature="banners"><SponsorBannersPage /></SponsorFeatureGate></SponsorProtectedRoute>),
});
