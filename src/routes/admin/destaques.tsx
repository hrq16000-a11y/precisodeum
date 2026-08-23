import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminHighlightsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminHighlightsPage")));

export const Route = createFileRoute("/admin/destaques")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminHighlightsPage"><AdminHighlightsPage /></RouteErrorBoundary></AdminGuard>),
});
