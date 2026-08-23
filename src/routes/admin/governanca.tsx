import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminGovernancePage = reactLazy(() => importWithRetry(() => import("@/pages/AdminGovernancePage")));

export const Route = createFileRoute("/admin/governanca")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminGovernancePage"><AdminGovernancePage /></RouteErrorBoundary></AdminGuard>),
});
