import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/onboarding-funnel")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/onboarding-ops/funnel", replace: true });
  },
});
