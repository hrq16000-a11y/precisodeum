import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminJobsImportPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminJobsImportPage")));

export const Route = createFileRoute("/admin/vagas/importar")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminJobsImportPage"><AdminJobsImportPage /></RouteErrorBoundary></AdminGuard>),
});
