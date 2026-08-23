import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminAdSlotsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminAdSlotsPage")));

export const Route = createFileRoute("/admin/slots-anuncios")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminAdSlotsPage"><AdminAdSlotsPage /></RouteErrorBoundary></AdminGuard>),
});
