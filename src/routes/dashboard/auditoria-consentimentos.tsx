import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardConsentAuditPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardConsentAuditPage")));

export const Route = createFileRoute("/dashboard/auditoria-consentimentos")({
  component: () => (<ProtectedRoute><DashboardConsentAuditPage /></ProtectedRoute>),
});
