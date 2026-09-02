import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { getServiceVertical } from "@/lib/programmaticServices";

/** Layout das verticais programáticas: /servico/{slug} e /servico/{slug}/{local} */
export const Route = createFileRoute("/servico/$serviceSlug")({
  loader: ({ params }) => {
    if (!getServiceVertical(params.serviceSlug)) throw notFound();
    return null;
  },
  component: () => <Outlet />,
});
