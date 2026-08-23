import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/onboarding")({
  beforeLoad: () => {
    throw redirect({ href: "/admin/wizard-diagnostico", replace: true });
  },
});
