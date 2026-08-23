import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const CategoryPage = reactLazy(() => importWithRetry(() => import("@/pages/CategoryPage")));

export const Route = createFileRoute("/categoria/$slug")({
  component: () => (<CategoryPage />),
});
