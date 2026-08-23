import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardClientContactsPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardClientContactsPage")));

export const Route = createFileRoute("/dashboard/cliente/contatos")({
  component: () => (<ProtectedRoute><DashboardClientContactsPage /></ProtectedRoute>),
});
