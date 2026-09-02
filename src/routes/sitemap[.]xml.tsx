import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { fetchSitemapXml } from "@/lib/seo/sitemapProxy";

/**
 * Índice de sitemaps servido server-side (XML real).
 *
 * Antes esta rota renderizava um componente que redirecionava via JS para a
 * function `sitemap` — crawlers recebiam HTML vazio. Agora o servidor busca o
 * XML e devolve com Content-Type correto, preservando o gerador único.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => fetchSitemapXml(request, new URLSearchParams()),
    },
  },
});
