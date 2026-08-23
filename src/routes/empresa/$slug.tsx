import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const CompanyProfile = reactLazy(() => importWithRetry(() => import("@/pages/CompanyProfile")));

export const Route = createFileRoute("/empresa/$slug")({
  component: () => (<CompanyProfile />),
});
