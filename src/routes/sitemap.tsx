import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { fetchSitemapXml } from "@/lib/seo/sitemapProxy";

/**
 * Sub-sitemaps por tipo: /sitemap?type=categories&page=2
 * Servido server-side em XML (sem redirect client-side).
 */
export const Route = createFileRoute("/sitemap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const params = new URLSearchParams();
        const type = url.searchParams.get("type");
        const page = url.searchParams.get("page");
        if (type) params.set("type", type);
        if (page) params.set("page", page);
        return fetchSitemapXml(request, params);
      },
    },
  },
});
