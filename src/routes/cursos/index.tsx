import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const CoursesPage = reactLazy(() => importWithRetry(() => import("@/pages/CoursesPage")));

export const Route = createFileRoute("/cursos/")({
  component: () => (<CoursesPage />),
});
