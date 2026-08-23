import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorGuard from "@/components/ErrorGuard";

const DashboardPortfolioPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardPortfolioPage")));

export const Route = createFileRoute("/dashboard/portfolio")({
  component: () => (<ProtectedRoute allowedTypes={['provider']}><ErrorGuard componentName="DashboardPortfolioPage"><DashboardPortfolioPage /></ErrorGuard></ProtectedRoute>),
});
