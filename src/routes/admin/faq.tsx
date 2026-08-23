import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminFaqPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminFaqPage")));

export const Route = createFileRoute("/admin/faq")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminFaqPage"><AdminFaqPage /></RouteErrorBoundary></AdminGuard>),
});
