import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const NeighborhoodPage = reactLazy(() => importWithRetry(() => import("@/pages/NeighborhoodPage")));

export const Route = createFileRoute("/cidade/$citySlug/bairro/$neighborhoodSlug")({
  component: () => (<NeighborhoodPage />),
});
