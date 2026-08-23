import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminServiceAreaCorrectionsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminServiceAreaCorrectionsPage")));

export const Route = createFileRoute("/admin/service-area-corrections")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminServiceAreaCorrectionsPage"><AdminServiceAreaCorrectionsPage /></RouteErrorBoundary></AdminGuard>),
});
