import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/marido-de-aluguel-{$citySlug}")({
  component: () => null,
});
