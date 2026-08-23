import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminAuditRefPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminAuditRefPage")));

export const Route = createFileRoute("/admin/auditoria-ref")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminAuditRefPage"><AdminAuditRefPage /></RouteErrorBoundary></AdminGuard>),
});
