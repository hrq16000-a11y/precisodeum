import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/seo-landings")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/seo/landings", replace: true });
  },
});
