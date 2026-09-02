import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminLeadGeoConversionPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminLeadGeoConversionPage")));

export const Route = createFileRoute("/admin/conversao-geo")({
  component: () => (
    <AdminGuard>
      <RouteErrorBoundary sectionName="AdminLeadGeoConversionPage">
        <AdminLeadGeoConversionPage />
      </RouteErrorBoundary>
    </AdminGuard>
  ),
});
