import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminCoursesPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminCoursesPage")));

export const Route = createFileRoute("/admin/cursos")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminCoursesPage"><AdminCoursesPage /></RouteErrorBoundary></AdminGuard>),
});
