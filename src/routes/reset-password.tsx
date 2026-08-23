import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const ResetPasswordPage = reactLazy(() => importWithRetry(() => import("@/pages/ResetPasswordPage")));

export const Route = createFileRoute("/reset-password")({
  component: () => (<ResetPasswordPage />),
});
