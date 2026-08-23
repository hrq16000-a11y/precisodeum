import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminJobsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminJobsPage")));

export const Route = createFileRoute("/admin/vagas")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminJobsPage"><AdminJobsPage /></RouteErrorBoundary></AdminGuard>),
});
