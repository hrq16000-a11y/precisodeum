import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";

const SponsorDataPage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorDataPage")));

export const Route = createFileRoute("/sponsor-panel/dados")({
  component: () => (<SponsorProtectedRoute><SponsorDataPage /></SponsorProtectedRoute>),
});
