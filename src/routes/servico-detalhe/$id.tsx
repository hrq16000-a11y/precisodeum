import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const ServiceDetailPage = reactLazy(() => importWithRetry(() => import("@/pages/ServiceDetailPage")));

export const Route = createFileRoute("/servico-detalhe/$id")({
  component: () => (<ServiceDetailPage />),
});
