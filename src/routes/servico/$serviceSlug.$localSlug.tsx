import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import { getServiceVertical } from "@/lib/programmaticServices";

const ServiceVerticalPage = reactLazy(() => importWithRetry(() => import("@/pages/HandymanServicePage")));

/** Landing local: /servico/pintor/curitiba e /servico/pintor/curitiba-batel */
export const Route = createFileRoute("/servico/$serviceSlug/$localSlug")({
  loader: ({ params }) => {
    if (!getServiceVertical(params.serviceSlug)) throw notFound();
    return null;
  },
  component: () => <ServiceVerticalPage regional />,
});
