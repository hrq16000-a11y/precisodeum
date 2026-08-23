import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";

const SponsorContractsPage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorContractsPage")));

export const Route = createFileRoute("/sponsor-panel/contratos")({
  component: () => (<SponsorProtectedRoute><SponsorContractsPage /></SponsorProtectedRoute>),
});
