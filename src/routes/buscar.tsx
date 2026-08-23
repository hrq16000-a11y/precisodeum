import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const SearchPage = reactLazy(() => importWithRetry(() => import("@/pages/SearchPage")));

export const Route = createFileRoute("/buscar")({
  component: () => (<SearchPage />),
});
