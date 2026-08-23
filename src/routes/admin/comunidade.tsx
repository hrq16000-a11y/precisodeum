import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminCommunityPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminCommunityPage")));

export const Route = createFileRoute("/admin/comunidade")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminCommunityPage"><AdminCommunityPage /></RouteErrorBoundary></AdminGuard>),
});
