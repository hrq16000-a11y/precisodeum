import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminConsentRevocationsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminConsentRevocationsPage")));

export const Route = createFileRoute("/admin/consent-revocations")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminConsentRevocationsPage"><AdminConsentRevocationsPage /></RouteErrorBoundary></AdminGuard>),
});
