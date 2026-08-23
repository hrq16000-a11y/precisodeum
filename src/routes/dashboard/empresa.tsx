import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardCompanyDataPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardCompanyDataPage")));

export const Route = createFileRoute("/dashboard/empresa")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><DashboardCompanyDataPage /></ProtectedRoute>),
});
