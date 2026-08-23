import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/onboarding-regression")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/onboarding-ops/regression", replace: true });
  },
});
