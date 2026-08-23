import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminMenuPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminMenuPage")));

export const Route = createFileRoute("/admin/menus")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminMenuPage"><AdminMenuPage /></RouteErrorBoundary></AdminGuard>),
});
