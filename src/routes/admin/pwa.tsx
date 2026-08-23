import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminPwaPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminPwaPage")));

export const Route = createFileRoute("/admin/pwa")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminPwaPage"><AdminPwaPage /></RouteErrorBoundary></AdminGuard>),
});
