import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const SponsorSlotsPage = reactLazy(() => importWithRetry(() => import("@/pages/SponsorSlotsPage")));

export const Route = createFileRoute("/espacos-patrocinio")({
  component: () => (<SponsorSlotsPage />),
});
