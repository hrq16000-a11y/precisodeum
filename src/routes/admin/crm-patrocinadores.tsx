import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSponsorCrmPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSponsorCrmPage")));

export const Route = createFileRoute("/admin/crm-patrocinadores")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorCrmPage"><AdminSponsorCrmPage /></RouteErrorBoundary></AdminGuard>),
});
