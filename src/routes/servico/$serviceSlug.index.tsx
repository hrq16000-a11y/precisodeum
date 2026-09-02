import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import { buildVerticalSeo, getServiceVertical } from "@/lib/programmaticServices";
import { SITE_BASE_URL } from "@/lib/siteAssets";

const ServiceVerticalPage = reactLazy(() => importWithRetry(() => import("@/pages/HandymanServicePage")));

/** Landing nacional programática: /servico/pintor, /servico/eletricista, ... */
export const Route = createFileRoute("/servico/$serviceSlug/")({
  head: ({ params }) => {
    const vertical = getServiceVertical(params.serviceSlug);
    if (!vertical) return {};
    const seo = buildVerticalSeo(vertical, null, 0);
    const url = `${SITE_BASE_URL}${seo.canonicalPath}`;
    return {
      meta: [
        { title: `${seo.title} | Preciso de um` },
        { name: "description", content: seo.description },
        { name: "keywords", content: seo.keywords },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: () => <ServiceVerticalPage />,
});
