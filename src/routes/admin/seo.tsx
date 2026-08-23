import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSeoPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminSeoPage")));

export const Route = createFileRoute("/admin/seo")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSeoPage"><AdminSeoPage /></RouteErrorBoundary></AdminGuard>),
});
