import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminMediaPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminMediaPage")));

export const Route = createFileRoute("/admin/midia")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminMediaPage"><AdminMediaPage /></RouteErrorBoundary></AdminGuard>),
});
