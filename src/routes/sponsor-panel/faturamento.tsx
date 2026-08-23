import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const SponsorBillingPage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorBillingPage")));

export const Route = createFileRoute("/sponsor-panel/faturamento")({
  component: () => (<SponsorProtectedRoute><RouteErrorBoundary sectionName="SponsorBillingPage"><SponsorBillingPage /></RouteErrorBoundary></SponsorProtectedRoute>),
});
