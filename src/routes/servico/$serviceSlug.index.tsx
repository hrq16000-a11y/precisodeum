import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const ServiceVerticalPage = reactLazy(() => importWithRetry(() => import("@/pages/HandymanServicePage")));

/** Landing nacional programática: /servico/pintor, /servico/eletricista, ... */
export const Route = createFileRoute("/servico/$serviceSlug/")({
  component: () => <ServiceVerticalPage />,
});
