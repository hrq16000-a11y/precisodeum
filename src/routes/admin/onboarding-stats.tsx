import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/onboarding-stats")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/onboarding-ops/stats", replace: true });
  },
});
