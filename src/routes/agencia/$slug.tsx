import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const AgencyPublicPage = reactLazy(() => importWithRetry(() => import("@/pages/AgencyPublicPage")));

export const Route = createFileRoute("/agencia/$slug")({
  component: () => (<AgencyPublicPage />),
});
