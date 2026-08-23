import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSystemHealthPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSystemHealthPage")));

export const Route = createFileRoute("/admin/sistema/saude")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSystemHealthPage"><AdminSystemHealthPage /></RouteErrorBoundary></AdminGuard>),
});
