import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardRouteGuard from "@/components/dashboard/DashboardRouteGuard";

const DashboardLeadDetailPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardLeadDetailPage")));

export const Route = createFileRoute("/dashboard/leads/$leadId")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardRouteGuard requiredPermission="leads"><DashboardLeadDetailPage /></DashboardRouteGuard></ProtectedRoute>),
});
