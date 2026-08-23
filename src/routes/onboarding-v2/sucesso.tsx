import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import ProtectedRoute from "@/components/ProtectedRoute";

const OnboardingV2SuccessPage = reactLazy(() => importWithRetry(() => import("@/pages/OnboardingV2SuccessPage")));

export const Route = createFileRoute("/onboarding-v2/sucesso")({
  component: () => (<ProtectedRoute><OnboardingV2SuccessPage /></ProtectedRoute>),
});
