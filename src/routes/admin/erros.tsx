import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminErrorReportsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminErrorReportsPage")));

export const Route = createFileRoute("/admin/erros")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminErrorReportsPage"><AdminErrorReportsPage /></RouteErrorBoundary></AdminGuard>),
});
