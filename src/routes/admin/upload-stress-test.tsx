import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminUploadStressTestPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminUploadStressTestPage")));

export const Route = createFileRoute("/admin/upload-stress-test")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminUploadStressTestPage"><AdminUploadStressTestPage /></RouteErrorBoundary></AdminGuard>),
});
