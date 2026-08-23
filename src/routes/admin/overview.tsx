import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminOverviewPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminOverviewPage")));

export const Route = createFileRoute("/admin/overview")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminOverviewPage"><AdminOverviewPage /></RouteErrorBoundary></AdminGuard>),
});
