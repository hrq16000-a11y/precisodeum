import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardIdentitySuggestionsPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardIdentitySuggestionsPage")));

export const Route = createFileRoute("/dashboard/sugestoes-identidade")({
  component: () => (<ProtectedRoute><DashboardIdentitySuggestionsPage /></ProtectedRoute>),
});
