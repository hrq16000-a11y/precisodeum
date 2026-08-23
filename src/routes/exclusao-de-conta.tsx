import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const AccountDeletionPage = reactLazy(() => importWithRetry(() => import("@/pages/AccountDeletionPage")));

export const Route = createFileRoute("/exclusao-de-conta")({
  component: () => (<AccountDeletionPage />),
});
