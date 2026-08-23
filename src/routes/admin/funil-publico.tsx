import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminPublicFunnelPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminPublicFunnelPage")));

export const Route = createFileRoute("/admin/funil-publico")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminPublicFunnelPage"><AdminPublicFunnelPage /></RouteErrorBoundary></AdminGuard>),
});
