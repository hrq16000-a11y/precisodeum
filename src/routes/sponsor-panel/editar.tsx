import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const SponsorSelfServicePage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorSelfServicePage")));

export const Route = createFileRoute("/sponsor-panel/editar")({
  component: () => (<SponsorProtectedRoute><RouteErrorBoundary sectionName="SponsorSelfServicePage"><SponsorSelfServicePage /></RouteErrorBoundary></SponsorProtectedRoute>),
});
