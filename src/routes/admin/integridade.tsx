import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminIntegrityReportsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminIntegrityReportsPage")));

export const Route = createFileRoute("/admin/integridade")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminIntegrityReportsPage"><AdminIntegrityReportsPage /></RouteErrorBoundary></AdminGuard>),
});
