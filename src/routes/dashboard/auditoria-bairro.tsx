import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardBadgeAuditPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardBadgeAuditPage")));

export const Route = createFileRoute("/dashboard/auditoria-bairro")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardBadgeAuditPage /></ProtectedRoute>),
});
