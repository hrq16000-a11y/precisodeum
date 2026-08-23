import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const SponsorPublicPage = reactLazy(() => importWithRetry(() => import("@/pages/SponsorPublicPage")));

export const Route = createFileRoute("/patrocinador/$slug")({
  component: () => (<SponsorPublicPage />),
});
