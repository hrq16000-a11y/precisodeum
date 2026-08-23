import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const FaqPage = reactLazy(() => importWithRetry(() => import("@/pages/FaqPage")));

export const Route = createFileRoute("/faq")({
  component: () => (<FaqPage />),
});
