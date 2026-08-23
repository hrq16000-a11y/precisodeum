import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminNotificationsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminNotificationsPage")));

export const Route = createFileRoute("/admin/notificacoes")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminNotificationsPage"><AdminNotificationsPage /></RouteErrorBoundary></AdminGuard>),
});
