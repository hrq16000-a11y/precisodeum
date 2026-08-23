import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminBottomNavPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminBottomNavPage")));

export const Route = createFileRoute("/admin/barra-inferior")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminBottomNavPage"><AdminBottomNavPage /></RouteErrorBoundary></AdminGuard>),
});
