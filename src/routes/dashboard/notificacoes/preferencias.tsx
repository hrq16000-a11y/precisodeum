import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardNotificationPreferencesPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardNotificationPreferencesPage")));

export const Route = createFileRoute("/dashboard/notificacoes/preferencias")({
  component: () => (<ProtectedRoute><DashboardNotificationPreferencesPage /></ProtectedRoute>),
});
