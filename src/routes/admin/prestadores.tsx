import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminProvidersPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminProvidersPage")));

export const Route = createFileRoute("/admin/prestadores")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminProvidersPage"><AdminProvidersPage /></RouteErrorBoundary></AdminGuard>),
});
