import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const BlogPostPage = reactLazy(() => importWithRetry(() => import("@/pages/BlogPostPage")));

export const Route = createFileRoute("/cursos/materias/$slug")({
  component: () => (<BlogPostPage />),
});
