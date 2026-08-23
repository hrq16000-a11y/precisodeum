import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminPortabilityDetailsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminPortabilityDetailsPage")));

export const Route = createFileRoute("/admin/portabilidade/detalhes")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminPortabilityDetailsPage"><AdminPortabilityDetailsPage /></RouteErrorBoundary></AdminGuard>),
});
