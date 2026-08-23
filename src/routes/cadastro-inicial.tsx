import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const CadastroInicialPage = reactLazy(() => importWithRetry(() => import("@/pages/CadastroInicialPage")));

export const Route = createFileRoute("/cadastro-inicial")({
  component: () => (<RouteErrorBoundary sectionName="Wizard"><CadastroInicialPage /></RouteErrorBoundary>),
});
