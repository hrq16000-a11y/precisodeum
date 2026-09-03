import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminLocalOptimizationPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminLocalOptimizationPage")));

export const Route = createFileRoute("/admin/otimizacao-local")({
  component: () => (
    <AdminGuard>
      <RouteErrorBoundary sectionName="AdminLocalOptimizationPage">
        <AdminLocalOptimizationPage />
      </RouteErrorBoundary>
    </AdminGuard>
  ),
});
