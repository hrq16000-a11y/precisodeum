import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardCadastroStatusPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardCadastroStatusPage")));

export const Route = createFileRoute("/dashboard/cadastro-status")({
  component: () => (<ProtectedRoute><DashboardCadastroStatusPage /></ProtectedRoute>),
});
