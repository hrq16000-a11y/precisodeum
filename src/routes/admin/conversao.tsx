import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminConversionMetricsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminConversionMetricsPage")));

export const Route = createFileRoute("/admin/conversao")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminConversionMetricsPage"><AdminConversionMetricsPage /></RouteErrorBoundary></AdminGuard>),
});
