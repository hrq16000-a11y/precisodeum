import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const ServiceVerticalPage = reactLazy(() => importWithRetry(() => import("@/pages/HandymanServicePage")));

/** Landing local: /servico/pintor/curitiba e /servico/pintor/curitiba-batel */
export const Route = createFileRoute("/servico/$serviceSlug/$localSlug")({
  component: () => <ServiceVerticalPage regional />,
});
