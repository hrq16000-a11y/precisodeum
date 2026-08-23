import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminApprovalSettingsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminApprovalSettingsPage")));

export const Route = createFileRoute("/admin/aprovacao")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminApprovalSettingsPage"><AdminApprovalSettingsPage /></RouteErrorBoundary></AdminGuard>),
});
