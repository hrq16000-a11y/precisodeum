import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminTrashPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminTrashPage")));

export const Route = createFileRoute("/admin/lixeira")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminTrashPage"><AdminTrashPage /></RouteErrorBoundary></AdminGuard>),
});
