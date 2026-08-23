import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminOrphanProfilesPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminOrphanProfilesPage")));

export const Route = createFileRoute("/admin/perfis-orfaos")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminOrphanProfilesPage"><AdminOrphanProfilesPage /></RouteErrorBoundary></AdminGuard>),
});
