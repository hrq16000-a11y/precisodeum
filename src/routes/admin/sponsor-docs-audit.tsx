import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSponsorDocsAuditPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminSponsorDocsAuditPage")));

export const Route = createFileRoute("/admin/sponsor-docs-audit")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorDocsAuditPage"><AdminSponsorDocsAuditPage /></RouteErrorBoundary></AdminGuard>),
});
