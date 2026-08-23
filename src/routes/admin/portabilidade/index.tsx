import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminPortabilityPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminPortabilityPage")));

export const Route = createFileRoute("/admin/portabilidade/")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminPortabilityPage"><AdminPortabilityPage /></RouteErrorBoundary></AdminGuard>),
});
