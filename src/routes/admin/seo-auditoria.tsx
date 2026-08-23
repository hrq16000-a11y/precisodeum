import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSeoAuditPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSeoAuditPage")));

export const Route = createFileRoute("/admin/seo-auditoria")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSeoAuditPage"><AdminSeoAuditPage /></RouteErrorBoundary></AdminGuard>),
});
