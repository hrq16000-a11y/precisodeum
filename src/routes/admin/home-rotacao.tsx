import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminHomeRotationPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminHomeRotationPage")));

export const Route = createFileRoute("/admin/home-rotacao")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminHomeRotationPage"><AdminHomeRotationPage /></RouteErrorBoundary></AdminGuard>),
});
