import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const ServicesPage = reactLazy(() => importWithRetry(() => import("@/pages/ServicesPage")));

export const Route = createFileRoute("/servicos")({
  component: () => (<ServicesPage />),
});
