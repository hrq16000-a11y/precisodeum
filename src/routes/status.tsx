import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const StatusPage = reactLazy(() => importWithRetry(() => import("@/pages/StatusPage")));

export const Route = createFileRoute("/status")({
  component: () => (<StatusPage />),
});
