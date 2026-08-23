import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const LoginPage = reactLazy(() => importWithRetry(() => import("@/pages/LoginPage")));

export const Route = createFileRoute("/login")({
  component: () => (<LoginPage />),
});
