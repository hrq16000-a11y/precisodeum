import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminLoadTestsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminLoadTestsPage")));

export const Route = createFileRoute("/admin/load-tests")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminLoadTestsPage"><AdminLoadTestsPage /></RouteErrorBoundary></AdminGuard>),
});
