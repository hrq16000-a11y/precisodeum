import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminDefaultNeighborhoodPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminDefaultNeighborhoodPage")));

export const Route = createFileRoute("/admin/bairro-default")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminDefaultNeighborhoodPage"><AdminDefaultNeighborhoodPage /></RouteErrorBoundary></AdminGuard>),
});
