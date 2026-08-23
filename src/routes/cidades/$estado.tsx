import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const StateProviderPage = reactLazy(() => importWithRetry(() => import("@/pages/StateProviderPage")));

export const Route = createFileRoute("/cidades/$estado")({
  component: () => (<StateProviderPage />),
});
