import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminAuthMetricsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminAuthMetricsPage")));

export const Route = createFileRoute("/admin/metricas-auth")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminAuthMetricsPage"><AdminAuthMetricsPage /></RouteErrorBoundary></AdminGuard>),
});
