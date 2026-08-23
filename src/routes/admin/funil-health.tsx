import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminPublicFunnelHealthPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminPublicFunnelHealthPage")));

export const Route = createFileRoute("/admin/funil-health")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminPublicFunnelHealthPage"><AdminPublicFunnelHealthPage /></RouteErrorBoundary></AdminGuard>),
});
