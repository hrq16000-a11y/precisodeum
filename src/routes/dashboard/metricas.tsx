import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardMetricsPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardMetricsPage")));

export const Route = createFileRoute("/dashboard/metricas")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardMetricsPage /></ProtectedRoute>),
});
