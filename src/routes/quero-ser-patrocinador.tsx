import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const SponsorLandingPage = reactLazy(() => importWithRetry(() => import("@/pages/SponsorLandingPage")));

export const Route = createFileRoute("/quero-ser-patrocinador")({
  component: () => (<SponsorLandingPage />),
});
