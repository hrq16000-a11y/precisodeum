import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";
import SponsorFeatureGate from "@/components/sponsor/SponsorFeatureGate";

const SponsorPublicProfilePage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorPublicProfilePage")));

export const Route = createFileRoute("/sponsor-panel/pagina")({
  component: () => (<SponsorProtectedRoute><SponsorFeatureGate><SponsorPublicProfilePage /></SponsorFeatureGate></SponsorProtectedRoute>),
});
