import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminBackupPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminBackupPage")));

export const Route = createFileRoute("/admin/backup")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminBackupPage"><AdminBackupPage /></RouteErrorBoundary></AdminGuard>),
});
