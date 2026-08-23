import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const CitiesListPage = reactLazy(() => importWithRetry(() => import("@/pages/CitiesListPage")));

export const Route = createFileRoute("/cidades/")({
  component: () => (<CitiesListPage />),
});
