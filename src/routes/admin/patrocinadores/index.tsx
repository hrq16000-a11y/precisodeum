import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSponsorsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSponsorsPage")));

export const Route = createFileRoute("/admin/patrocinadores/")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorsPage"><AdminSponsorsPage /></RouteErrorBoundary></AdminGuard>),
});
