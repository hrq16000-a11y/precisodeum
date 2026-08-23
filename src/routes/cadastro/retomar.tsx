import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const RecoveryOnboardingPage = reactLazy(() => importWithRetry(() => import("@/pages/RecoveryOnboardingPage")));

export const Route = createFileRoute("/cadastro/retomar")({
  component: () => (<RecoveryOnboardingPage />),
});
