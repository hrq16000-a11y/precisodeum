import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const SponsorStatusPage = reactLazy(() => importWithRetry(() => import("@/pages/SponsorStatusPage")));

export const Route = createFileRoute("/sponsor/status")({
  component: () => (<SponsorStatusPage />),
});
