import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminAuditLogPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminAuditLogPage")));

export const Route = createFileRoute("/admin/auditoria")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminAuditLogPage"><AdminAuditLogPage /></RouteErrorBoundary></AdminGuard>),
});
