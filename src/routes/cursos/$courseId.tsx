import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const CourseDetailPage = reactLazy(() => importWithRetry(() => import("@/pages/CourseDetailPage")));

export const Route = createFileRoute("/cursos/$courseId")({
  component: () => (<CourseDetailPage />),
});
