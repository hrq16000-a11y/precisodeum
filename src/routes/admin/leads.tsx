import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminLeadsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminLeadsPage")));

export const Route = createFileRoute("/admin/leads")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminLeadsPage"><AdminLeadsPage /></RouteErrorBoundary></AdminGuard>),
});
