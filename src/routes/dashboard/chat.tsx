import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const DashboardChatPage = reactLazy(() => importWithRetry(() => import("@/pages/DashboardChatPage")));

export const Route = createFileRoute("/dashboard/chat")({
  component: () => (<ProtectedRoute><DashboardChatPage /></ProtectedRoute>),
});
