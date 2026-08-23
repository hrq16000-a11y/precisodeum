import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSettingsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSettingsPage")));

export const Route = createFileRoute("/admin/configuracoes")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSettingsPage"><AdminSettingsPage /></RouteErrorBoundary></AdminGuard>),
});
