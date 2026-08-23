import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardNotificationsPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardNotificationsPage")));

export const Route = createFileRoute("/dashboard/notificacoes")({
  component: () => (<ProtectedRoute><DashboardNotificationsPage /></ProtectedRoute>),
});
