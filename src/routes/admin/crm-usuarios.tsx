import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminUsersCrmPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminUsersCrmPage")));

export const Route = createFileRoute("/admin/crm-usuarios")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminUsersCrmPage"><AdminUsersCrmPage /></RouteErrorBoundary></AdminGuard>),
});
