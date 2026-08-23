import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const ComoFuncionaPage = reactLazy(() => importWithRetry(() => import("@/pages/ComoFuncionaPage")));

export const Route = createFileRoute("/como-funciona")({
  component: () => (<ComoFuncionaPage />),
});
