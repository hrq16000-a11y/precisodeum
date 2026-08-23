import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/metatags")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/seo/metatags", replace: true });
  },
});
