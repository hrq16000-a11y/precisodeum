import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminPermissionsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminPermissionsPage")));

export const Route = createFileRoute("/admin/sistema/permissoes")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminPermissionsPage"><AdminPermissionsPage /></RouteErrorBoundary></AdminGuard>),
});
