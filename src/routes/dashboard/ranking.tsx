import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardRankingPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardRankingPage")));

export const Route = createFileRoute("/dashboard/ranking")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardRankingPage /></ProtectedRoute>),
});
