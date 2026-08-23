import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminHeroBannersPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminHeroBannersPage")));

export const Route = createFileRoute("/admin/hero-banners")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminHeroBannersPage"><AdminHeroBannersPage /></RouteErrorBoundary></AdminGuard>),
});
