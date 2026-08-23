import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardPrivacyPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardPrivacyPage")));

export const Route = createFileRoute("/dashboard/privacidade")({
  component: () => (<ProtectedRoute><DashboardPrivacyPage /></ProtectedRoute>),
});
