import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminUsersPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminUsersPage")));

export const Route = createFileRoute("/admin/usuarios")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminUsersPage"><AdminUsersPage /></RouteErrorBoundary></AdminGuard>),
});
