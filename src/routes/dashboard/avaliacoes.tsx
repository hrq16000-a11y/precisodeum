import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardRouteGuard from "@/components/dashboard/DashboardRouteGuard";

const DashboardReviewsPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardReviewsPage")));

export const Route = createFileRoute("/dashboard/avaliacoes")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardRouteGuard requiredPermission="reviews"><DashboardReviewsPage /></DashboardRouteGuard></ProtectedRoute>),
});
