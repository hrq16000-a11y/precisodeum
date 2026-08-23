import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminModulesPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminModulesPage")));

export const Route = createFileRoute("/admin/modulos")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminModulesPage"><AdminModulesPage /></RouteErrorBoundary></AdminGuard>),
});
