import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sitemap-audit")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/seo/sitemap", replace: true });
  },
});
