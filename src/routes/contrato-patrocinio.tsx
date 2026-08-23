import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const SponsorContractPage = reactLazy(() => importWithRetry(() => import("@/pages/SponsorContractPage")));

export const Route = createFileRoute("/contrato-patrocinio")({
  component: () => (<SponsorContractPage />),
});
