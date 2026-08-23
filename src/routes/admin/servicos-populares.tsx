import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminPopularServicesPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminPopularServicesPage")));

export const Route = createFileRoute("/admin/servicos-populares")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminPopularServicesPage"><AdminPopularServicesPage /></RouteErrorBoundary></AdminGuard>),
});
