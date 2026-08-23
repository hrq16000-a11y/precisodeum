import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSearchAuditPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSearchAuditPage")));

export const Route = createFileRoute("/admin/busca-auditoria")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSearchAuditPage"><AdminSearchAuditPage /></RouteErrorBoundary></AdminGuard>),
});
