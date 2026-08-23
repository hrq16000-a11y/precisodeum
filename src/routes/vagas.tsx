import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const JobsPage = reactLazy(() => importWithRetry(() => import("@/pages/JobsPage")));

export const Route = createFileRoute("/vagas")({
  component: () => (<JobsPage />),
});
