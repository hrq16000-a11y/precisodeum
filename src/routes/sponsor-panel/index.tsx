import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";

const SponsorDashboardPage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorDashboardPage")));

export const Route = createFileRoute("/sponsor-panel/")({
  component: () => (<SponsorProtectedRoute><SponsorDashboardPage /></SponsorProtectedRoute>),
});
