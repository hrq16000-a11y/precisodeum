import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminCitiesPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminCitiesPage")));

export const Route = createFileRoute("/admin/cidades")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminCitiesPage"><AdminCitiesPage /></RouteErrorBoundary></AdminGuard>),
});
