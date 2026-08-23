import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminOnboardingHubPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminOnboardingHubPage")));

export const Route = createFileRoute("/admin/onboarding-ops/$tab")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminOnboardingHubPage"><AdminOnboardingHubPage /></RouteErrorBoundary></AdminGuard>),
});
