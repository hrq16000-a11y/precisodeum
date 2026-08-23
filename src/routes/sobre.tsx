import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const AboutPage = reactLazy(() => importWithRetry(() => import("@/pages/AboutPage")));

export const Route = createFileRoute("/sobre")({
  component: () => (<AboutPage />),
});
