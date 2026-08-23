import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminCtaBlocksPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminCtaBlocksPage")));

export const Route = createFileRoute("/admin/cta-blocos")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminCtaBlocksPage"><AdminCtaBlocksPage /></RouteErrorBoundary></AdminGuard>),
});
