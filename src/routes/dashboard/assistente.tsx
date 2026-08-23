import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardAssistantPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardAssistantPage")));

export const Route = createFileRoute("/dashboard/assistente")({
  component: () => (<ProtectedRoute><DashboardAssistantPage /></ProtectedRoute>),
});
