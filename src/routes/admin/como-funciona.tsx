import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminHomeStepsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminHomeStepsPage")));

export const Route = createFileRoute("/admin/como-funciona")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminHomeStepsPage"><AdminHomeStepsPage /></RouteErrorBoundary></AdminGuard>),
});
