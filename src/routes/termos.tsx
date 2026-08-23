import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const TermsPage = reactLazy(() => importWithRetry(() => import("@/pages/TermsPage")));

export const Route = createFileRoute("/termos")({
  component: () => (<TermsPage />),
});
