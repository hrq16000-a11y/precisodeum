import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSearchSortingPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminSearchSortingPage")));

export const Route = createFileRoute("/admin/busca-ordenacao")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSearchSortingPage"><AdminSearchSortingPage /></RouteErrorBoundary></AdminGuard>),
});
