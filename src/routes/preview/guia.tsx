import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const GuidePreviewPage = reactLazy(() => importWithRetry(() => import("@/pages/GuidePreviewPage")));

export const Route = createFileRoute("/preview/guia")({
  component: () => (<GuidePreviewPage />),
});
