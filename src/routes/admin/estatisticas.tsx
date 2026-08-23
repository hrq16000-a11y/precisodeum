import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminStatsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminStatsPage")));

export const Route = createFileRoute("/admin/estatisticas")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminStatsPage"><AdminStatsPage /></RouteErrorBoundary></AdminGuard>),
});
