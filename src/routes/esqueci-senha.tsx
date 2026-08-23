import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const ForgotPasswordPage = reactLazy(() => importWithRetry(() => import("@/pages/ForgotPasswordPage")));

export const Route = createFileRoute("/esqueci-senha")({
  component: () => (<ForgotPasswordPage />),
});
