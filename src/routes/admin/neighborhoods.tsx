import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminNeighborhoodsCrudPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminNeighborhoodsCrudPage")));

export const Route = createFileRoute("/admin/neighborhoods")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminNeighborhoodsCrudPage"><AdminNeighborhoodsCrudPage /></RouteErrorBoundary></AdminGuard>),
});
