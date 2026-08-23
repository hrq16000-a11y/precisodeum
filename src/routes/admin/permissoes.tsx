import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/permissoes")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/sistema/permissoes", replace: true });
  },
});
