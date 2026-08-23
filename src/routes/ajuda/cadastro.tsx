import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const HelpOnboardingPage = reactLazy(() => importWithRetry(() => import("@/pages/HelpOnboardingPage")));

export const Route = createFileRoute("/ajuda/cadastro")({
  component: () => (<HelpOnboardingPage />),
});
