import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardLocationGuidedPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardLocationGuidedPage")));

export const Route = createFileRoute("/dashboard/localizacao-guiada")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardLocationGuidedPage /></ProtectedRoute>),
});
