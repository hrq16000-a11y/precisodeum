import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import SponsorProtectedRoute from "@/components/SponsorProtectedRoute";

const SponsorNotificationsPage = reactLazy(() => importWithRetry(() => import("@/pages/sponsor/SponsorNotificationsPage")));

export const Route = createFileRoute("/sponsor-panel/notificacoes")({
  component: () => (<SponsorProtectedRoute><SponsorNotificationsPage /></SponsorProtectedRoute>),
});
