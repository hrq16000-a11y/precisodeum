import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const ProviderProfile = reactLazy(() => importWithRetry(() => import("@/pages/ProviderProfile")));

export const Route = createFileRoute("/profissional/$slug")({
  component: () => (<RouteErrorBoundary sectionName="ProviderProfile"><ProviderProfile /></RouteErrorBoundary>),
});
