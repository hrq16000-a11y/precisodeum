import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/links-quebrados")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/seo/broken-links", replace: true });
  },
});
