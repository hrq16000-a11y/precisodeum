import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminLocalizacoesPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminLocalizacoesPage")));

export const Route = createFileRoute("/admin/localizacoes")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminLocalizacoesPage"><AdminLocalizacoesPage /></RouteErrorBoundary></AdminGuard>),
});
