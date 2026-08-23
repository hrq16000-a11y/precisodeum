import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminAuthHealthPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminAuthHealthPage")));

export const Route = createFileRoute("/admin/health-check")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminAuthHealthPage"><AdminAuthHealthPage /></RouteErrorBoundary></AdminGuard>),
});
