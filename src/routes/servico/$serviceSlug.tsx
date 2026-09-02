import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import { getServiceVertical } from "@/lib/programmaticServices";

const ServiceVerticalPage = reactLazy(() => importWithRetry(() => import("@/pages/HandymanServicePage")));

/** Landing nacional programática: /servico/pintor, /servico/eletricista, ... */
export const Route = createFileRoute("/servico/$serviceSlug")({
  loader: ({ params }) => {
    if (!getServiceVertical(params.serviceSlug)) throw notFound();
    return null;
  },
  component: () => <ServiceVerticalPage />,
});
