import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const PopularServicePage = reactLazy(() => importWithRetry(() => import("@/pages/PopularServicePage")));

export const Route = createFileRoute("/servico/$slug")({
  component: () => (<PopularServicePage />),
});
