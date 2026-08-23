import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardRouteGuard from "@/components/dashboard/DashboardRouteGuard";

const DashboardCommunityPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardCommunityPage")));

export const Route = createFileRoute("/dashboard/comunidade")({
  component: () => (<ProtectedRoute><DashboardRouteGuard requiredPermission="community"><DashboardCommunityPage /></DashboardRouteGuard></ProtectedRoute>),
});
