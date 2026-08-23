import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminHomeSectionsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminHomeSectionsPage")));

export const Route = createFileRoute("/admin/secoes-home")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminHomeSectionsPage"><AdminHomeSectionsPage /></RouteErrorBoundary></AdminGuard>),
});
