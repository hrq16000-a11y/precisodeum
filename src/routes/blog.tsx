import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const BlogPage = reactLazy(() => importWithRetry(() => import("@/pages/BlogPage")));

export const Route = createFileRoute("/blog")({
  component: () => (<BlogPage />),
});
