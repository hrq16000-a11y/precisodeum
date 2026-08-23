import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSponsorBillingPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSponsorBillingPage")));

export const Route = createFileRoute("/admin/sponsor-billing")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorBillingPage"><AdminSponsorBillingPage /></RouteErrorBoundary></AdminGuard>),
});
