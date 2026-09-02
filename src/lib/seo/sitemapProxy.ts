/**
 * Proxy server-side do gerador de sitemaps.
 *
 * O gerador (edge function `sitemap`, verify_jwt = false) continua sendo a
 * fonte única de verdade das URLs; aqui apenas entregamos o XML no domínio
 * público, com headers de cache/ETag preservados, para que crawlers leiam
 * XML de verdade em vez de HTML com redirect JS.
 */

const TTL_SECONDS = 3600;
const SWR_SECONDS = TTL_SECONDS * 6;

function resolveGeneratorBase(): string | null {
  const base =
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    null;
  return base ? `${base.replace(/\/$/, "")}/functions/v1/sitemap` : null;
}

function emptyUrlset(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "</urlset>",
  ].join("\n");
}

export async function fetchSitemapXml(
  request: Request,
  params: URLSearchParams,
): Promise<Response> {
  const base = resolveGeneratorBase();
  const headers: Record<string, string> = {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": `public, max-age=300, s-maxage=${TTL_SECONDS}, stale-while-revalidate=${SWR_SECONDS}`,
  };

  if (!base) {
    return new Response(emptyUrlset(), { status: 200, headers });
  }

  const query = params.toString();
  const target = query ? `${base}?${query}` : base;

  try {
    const ifNoneMatch = request.headers.get("if-none-match");
    const upstream = await fetch(target, {
      headers: ifNoneMatch ? { "if-none-match": ifNoneMatch } : undefined,
    });

    if (upstream.status === 304) {
      const etag = upstream.headers.get("etag");
      return new Response(null, {
        status: 304,
        headers: etag ? { ...headers, ETag: etag } : headers,
      });
    }

    if (!upstream.ok) {
      return new Response(emptyUrlset(), { status: 200, headers });
    }

    const xml = await upstream.text();
    const etag = upstream.headers.get("etag");
    return new Response(xml, {
      status: 200,
      headers: etag ? { ...headers, ETag: etag } : headers,
    });
  } catch {
    return new Response(emptyUrlset(), { status: 200, headers });
  }
}
