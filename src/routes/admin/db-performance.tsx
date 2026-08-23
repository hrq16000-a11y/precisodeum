import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminDbPerformancePage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminDbPerformancePage")));

export const Route = createFileRoute("/admin/db-performance")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminDbPerformancePage"><AdminDbPerformancePage /></RouteErrorBoundary></AdminGuard>),
});
