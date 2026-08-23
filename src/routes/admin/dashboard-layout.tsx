import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminDashboardLayoutPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminDashboardLayoutPage")));

export const Route = createFileRoute("/admin/dashboard-layout")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminDashboardLayoutPage"><AdminDashboardLayoutPage /></RouteErrorBoundary></AdminGuard>),
});
