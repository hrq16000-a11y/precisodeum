import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const HandymanServicePage = reactLazy(() => importWithRetry(() => import("@/pages/HandymanServicePage")));

export const Route = createFileRoute("/servico/marido-de-aluguel")({
  component: () => (<HandymanServicePage />),
});
