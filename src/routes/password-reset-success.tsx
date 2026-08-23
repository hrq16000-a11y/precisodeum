import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const ResetPasswordSuccessPage = reactLazy(() => importWithRetry(() => import("@/pages/ResetPasswordSuccessPage")));

export const Route = createFileRoute("/password-reset-success")({
  component: () => (<ResetPasswordSuccessPage />),
});
