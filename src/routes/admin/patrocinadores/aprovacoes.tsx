import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSponsorApprovalsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminSponsorApprovalsPage")));

export const Route = createFileRoute("/admin/patrocinadores/aprovacoes")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorApprovalsPage"><AdminSponsorApprovalsPage /></RouteErrorBoundary></AdminGuard>),
});
