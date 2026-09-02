import { createFileRoute } from "@tanstack/react-router";
import { lazy as reactLazy } from "react";
import { importWithRetry } from "@/lib/lazyWithRetry";
import { buildVerticalSeo, getServiceVertical } from "@/lib/programmaticServices";
import { resolveServiceLocal } from "@/lib/serviceLocal.functions";
import { humanizeSlug } from "@/lib/handymanServiceContent";
import { SITE_BASE_URL } from "@/lib/siteAssets";

const ServiceVerticalPage = reactLazy(() => importWithRetry(() => import("@/pages/HandymanServicePage")));

/** Landing local: /servico/pintor/curitiba e /servico/pintor/curitiba-batel */
export const Route = createFileRoute("/servico/$serviceSlug/$localSlug")({
  // Resolve cidade/bairro no servidor para que o head() saia correto no HTML.
  loader: ({ params }) => resolveServiceLocal({ data: { localSlug: params.localSlug } }),
  head: ({ params, loaderData }) => {
    const vertical = getServiceVertical(params.serviceSlug);
    if (!vertical) return {};
    const place = loaderData
      ? {
          cityLabel: loaderData.cityLabel,
          state: loaderData.state,
          citySlug: loaderData.citySlug,
          neighborhoodLabel: loaderData.neighborhoodLabel || null,
          neighborhoodSlug: loaderData.neighborhoodSlug || null,
        }
      : { cityLabel: humanizeSlug(params.localSlug), citySlug: params.localSlug, state: null };
    const seo = buildVerticalSeo(vertical, place, 0);
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
  component: () => <ServiceVerticalPage regional />,
});
