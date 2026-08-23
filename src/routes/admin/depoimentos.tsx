import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminTestimonialsPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminTestimonialsPage")));

export const Route = createFileRoute("/admin/depoimentos")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminTestimonialsPage"><AdminTestimonialsPage /></RouteErrorBoundary></AdminGuard>),
});
