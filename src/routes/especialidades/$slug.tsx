import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const EspecialidadeDetailPage = reactLazy(() => importWithRetry(() => import("@/pages/EspecialidadeDetailPage")));

export const Route = createFileRoute("/especialidades/$slug")({
  component: () => (<EspecialidadeDetailPage />),
});
