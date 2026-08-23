import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardOnboardingStatusPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardOnboardingStatusPage")));

export const Route = createFileRoute("/dashboard/status")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardOnboardingStatusPage /></ProtectedRoute>),
});
