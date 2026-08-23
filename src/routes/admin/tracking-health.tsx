import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminTrackingHealthPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminTrackingHealthPage")));

export const Route = createFileRoute("/admin/tracking-health")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminTrackingHealthPage"><AdminTrackingHealthPage /></RouteErrorBoundary></AdminGuard>),
});
