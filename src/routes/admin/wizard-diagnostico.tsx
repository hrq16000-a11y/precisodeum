import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/wizard-diagnostico")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/onboarding-ops/wizard-debug", replace: true });
  },
});
