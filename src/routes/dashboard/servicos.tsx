import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardRouteGuard from "@/components/dashboard/DashboardRouteGuard";
import ErrorGuard from "@/components/ErrorGuard";

const DashboardServicesPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardServicesPage")));

export const Route = createFileRoute("/dashboard/servicos")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardRouteGuard requiredPermission="services"><ErrorGuard componentName="DashboardServicesPage"><DashboardServicesPage /></ErrorGuard></DashboardRouteGuard></ProtectedRoute>),
});
