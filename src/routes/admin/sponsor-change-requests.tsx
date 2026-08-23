import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSponsorChangeRequestsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSponsorChangeRequestsPage")));

export const Route = createFileRoute("/admin/sponsor-change-requests")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorChangeRequestsPage"><AdminSponsorChangeRequestsPage /></RouteErrorBoundary></AdminGuard>),
});
