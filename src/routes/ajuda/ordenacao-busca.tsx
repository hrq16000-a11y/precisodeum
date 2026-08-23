import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const HelpSearchSortingPage = reactLazy(() => importWithRetry(() => import("@/pages/HelpSearchSortingPage")));

export const Route = createFileRoute("/ajuda/ordenacao-busca")({
  component: () => (<HelpSearchSortingPage />),
});
