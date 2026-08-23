import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminKillSwitchBlocksPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminKillSwitchBlocksPage")));

export const Route = createFileRoute("/admin/kill-switch-blocks")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminKillSwitchBlocksPage"><AdminKillSwitchBlocksPage /></RouteErrorBoundary></AdminGuard>),
});
