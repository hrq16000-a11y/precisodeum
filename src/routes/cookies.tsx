import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const CookiesPage = reactLazy(() => importWithRetry(() => import("@/pages/CookiesPage")));

export const Route = createFileRoute("/cookies")({
  component: () => (<CookiesPage />),
});
