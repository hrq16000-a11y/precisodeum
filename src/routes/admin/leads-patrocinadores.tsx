import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSponsorLeadsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSponsorLeadsPage")));

export const Route = createFileRoute("/admin/leads-patrocinadores")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorLeadsPage"><AdminSponsorLeadsPage /></RouteErrorBoundary></AdminGuard>),
});
