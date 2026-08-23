import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminRegressionReportsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminRegressionReportsPage")));

export const Route = createFileRoute("/admin/regressao")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminRegressionReportsPage"><AdminRegressionReportsPage /></RouteErrorBoundary></AdminGuard>),
});
