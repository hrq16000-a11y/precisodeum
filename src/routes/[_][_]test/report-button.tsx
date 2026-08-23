import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import { WizardSupportTestHarness } from "@/components/wizard/WizardSupportTestHarness";

const NotFound = reactLazy(() => importWithRetry(() => import("@/pages/NotFound")));

export const Route = createFileRoute("/__test/report-button")({
  component: () => (import.meta.env.DEV ? <WizardSupportTestHarness /> : <NotFound />),
});
