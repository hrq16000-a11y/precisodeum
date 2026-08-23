import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminError500Page = reactLazy(() => importWithRetry(() => import("@/pages/AdminError500Page")));

export const Route = createFileRoute("/admin/erros-500")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminError500Page"><AdminError500Page /></RouteErrorBoundary></AdminGuard>),
});
