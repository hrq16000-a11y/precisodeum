import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSubscriptionsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminSubscriptionsPage")));

export const Route = createFileRoute("/admin/subscriptions")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSubscriptionsPage"><AdminSubscriptionsPage /></RouteErrorBoundary></AdminGuard>),
});
