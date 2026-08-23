import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const SitemapRedirect = reactLazy(() => importWithRetry(() => import("@/pages/SitemapRedirect")));

export const Route = createFileRoute("/sitemap.xml")({
  component: () => (<SitemapRedirect />),
});
