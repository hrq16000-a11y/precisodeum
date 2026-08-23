import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminInstitutionalPagesPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminInstitutionalPagesPage")));

export const Route = createFileRoute("/admin/paginas")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminInstitutionalPagesPage"><AdminInstitutionalPagesPage /></RouteErrorBoundary></AdminGuard>),
});
