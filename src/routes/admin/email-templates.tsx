import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminEmailTemplatesPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminEmailTemplatesPage")));

export const Route = createFileRoute("/admin/email-templates")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminEmailTemplatesPage"><AdminEmailTemplatesPage /></RouteErrorBoundary></AdminGuard>),
});
