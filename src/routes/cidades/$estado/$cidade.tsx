import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const CityDetailPage = reactLazy(() => importWithRetry(() => import("@/pages/CityDetailPage")));

export const Route = createFileRoute("/cidades/$estado/$cidade")({
  component: () => (<CityDetailPage />),
});
