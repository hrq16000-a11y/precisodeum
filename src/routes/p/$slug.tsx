import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const InstitutionalPage = reactLazy(() => importWithRetry(() => import("@/pages/InstitutionalPage")));

export const Route = createFileRoute("/p/$slug")({
  component: () => (<InstitutionalPage />),
});
