import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardRouteGuard from "@/components/dashboard/DashboardRouteGuard";

const DashboardOpenLeadsPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardOpenLeadsPage")));

export const Route = createFileRoute("/dashboard/leads-abertos")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardRouteGuard requiredPermission="leads"><DashboardOpenLeadsPage /></DashboardRouteGuard></ProtectedRoute>),
});
