import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminCategoryOpportunitiesPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminCategoryOpportunitiesPage")));

export const Route = createFileRoute("/admin/oportunidades-categoria")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminCategoryOpportunitiesPage"><AdminCategoryOpportunitiesPage /></RouteErrorBoundary></AdminGuard>),
});
