import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminChatPage = reactLazy(() => importWithRetry(() => import("@/pages/AdminChatPage")));

export const Route = createFileRoute("/admin/chat")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminChatPage"><AdminChatPage /></RouteErrorBoundary></AdminGuard>),
});
