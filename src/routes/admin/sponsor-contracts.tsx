import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSponsorContractsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminSponsorContractsPage")));

export const Route = createFileRoute("/admin/sponsor-contracts")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorContractsPage"><AdminSponsorContractsPage /></RouteErrorBoundary></AdminGuard>),
});
