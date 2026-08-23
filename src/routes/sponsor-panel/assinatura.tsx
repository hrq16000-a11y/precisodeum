import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";

const SponsorSubscriptionPage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorSubscriptionPage")));

export const Route = createFileRoute("/sponsor-panel/assinatura")({
  component: () => (<SponsorProtectedRoute><SponsorSubscriptionPage /></SponsorProtectedRoute>),
});
