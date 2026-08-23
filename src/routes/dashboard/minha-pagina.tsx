import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardRouteGuard from "@/components/dashboard/DashboardRouteGuard";

const DashboardMyPagePage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardMyPagePage")));

export const Route = createFileRoute("/dashboard/minha-pagina")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardRouteGuard requiredPermission="my_page"><DashboardMyPagePage /></DashboardRouteGuard></ProtectedRoute>),
});
