import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const PrivacyPage = reactLazy(() => importWithRetry(() => import("@/pages/PrivacyPage")));

export const Route = createFileRoute("/privacidade")({
  component: () => (<PrivacyPage />),
});
