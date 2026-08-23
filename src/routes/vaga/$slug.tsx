import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const JobDetailPage = reactLazy(() => importWithRetry(() => import("@/pages/JobDetailPage")));

export const Route = createFileRoute("/vaga/$slug")({
  component: () => (<JobDetailPage />),
});
