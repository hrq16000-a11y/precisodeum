import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const HelpOnlineOfflinePage = reactLazy(() => importWithRetry(() => import("@/pages/HelpOnlineOfflinePage")));

export const Route = createFileRoute("/ajuda/online-offline")({
  component: () => (<HelpOnlineOfflinePage />),
});
