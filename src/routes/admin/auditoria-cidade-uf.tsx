import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminLocationSeoAuditPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminLocationSeoAuditPage")));

export const Route = createFileRoute("/admin/auditoria-cidade-uf")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminLocationSeoAuditPage"><AdminLocationSeoAuditPage /></RouteErrorBoundary></AdminGuard>),
});
