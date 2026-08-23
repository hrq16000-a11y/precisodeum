import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/meta-tracking-quality")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/seo/meta-tracking", replace: true });
  },
});
