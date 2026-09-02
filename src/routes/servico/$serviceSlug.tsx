import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout das verticais programáticas: /servico/{slug} e /servico/{slug}/{local} */
export const Route = createFileRoute("/servico/$serviceSlug")({
  component: () => <Outlet />,
});
