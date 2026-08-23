import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminProviderConversionPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminProviderConversionPage")));

export const Route = createFileRoute("/admin/provider-conversion")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminProviderConversionPage"><AdminProviderConversionPage /></RouteErrorBoundary></AdminGuard>),
});
