import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardRouteGuard from "@/components/dashboard/DashboardRouteGuard";

const DashboardLeadsPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardLeadsPage")));

export const Route = createFileRoute("/dashboard/leads")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardRouteGuard requiredPermission="leads"><DashboardLeadsPage /></DashboardRouteGuard></ProtectedRoute>),
});
