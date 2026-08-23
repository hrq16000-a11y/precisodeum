import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardAgencyDataPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardAgencyDataPage")));

export const Route = createFileRoute("/dashboard/agencia")({
  component: () => (<ProtectedRoute allowedTypes={['rh']}><DashboardAgencyDataPage /></ProtectedRoute>),
});
