import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminAuditRlsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminAuditRlsPage")));

export const Route = createFileRoute("/admin/auditoria-rls")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminAuditRlsPage"><AdminAuditRlsPage /></RouteErrorBoundary></AdminGuard>),
});
