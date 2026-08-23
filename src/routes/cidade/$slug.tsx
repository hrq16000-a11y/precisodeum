import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const CityPage = reactLazy(() => importWithRetry(() => import("@/pages/CityPage")));

export const Route = createFileRoute("/cidade/$slug")({
  component: () => (<CityPage />),
});
