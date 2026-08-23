import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardPage")));

export const Route = createFileRoute("/dashboard")({
  component: () => (<ProtectedRoute><DashboardPage /></ProtectedRoute>),
});
