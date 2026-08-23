import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorGuard from "@/components/ErrorGuard";

const DashboardProfilePage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardProfilePage")));

export const Route = createFileRoute("/dashboard/perfil")({
  component: () => (<ProtectedRoute><ErrorGuard componentName="DashboardProfilePage"><DashboardProfilePage /></ErrorGuard></ProtectedRoute>),
});
