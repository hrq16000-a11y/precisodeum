import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";

const ErrorPage = reactLazy(() => importWithRetry(() => import("@/pages/ErrorPage")));

export const Route = createFileRoute("/404")({
  component: () => (<ErrorPage code={404} />),
});
