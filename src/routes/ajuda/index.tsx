import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const HelpCenterPage = reactLazy(() => importWithRetry(() => import("@/pages/HelpCenterPage")));

export const Route = createFileRoute("/ajuda/")({
  component: () => (<HelpCenterPage />),
});
