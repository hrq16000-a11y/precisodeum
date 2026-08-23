import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/seo-runtime")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/seo/runtime", replace: true });
  },
});
