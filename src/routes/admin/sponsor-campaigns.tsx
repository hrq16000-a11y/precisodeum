import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import AdminGuard from "@/components/AdminGuard";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const AdminSponsorCampaignsPage = reactLazy(() => importWithRetry(() => import("@/pages/admin/AdminSponsorCampaignsPage")));

export const Route = createFileRoute("/admin/sponsor-campaigns")({
  component: () => (<AdminGuard><RouteErrorBoundary sectionName="AdminSponsorCampaignsPage"><AdminSponsorCampaignsPage /></RouteErrorBoundary></AdminGuard>),
});
