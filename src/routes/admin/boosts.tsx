import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminBoostsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminBoostsPage")));

export const Route = createFileRoute("/admin/boosts")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminBoostsPage"><AdminBoostsPage /></RouteErrorBoundary></AdminGuard>),
});
