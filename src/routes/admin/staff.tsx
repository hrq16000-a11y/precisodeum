import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminStaffPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminStaffPage")));

export const Route = createFileRoute("/admin/staff")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminStaffPage"><AdminStaffPage /></RouteErrorBoundary></AdminGuard>),
});
