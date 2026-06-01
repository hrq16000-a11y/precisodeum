// Google Search Console helper. Used by /admin/seo/gsc.
// Actions: status | get-token | verify | add | list | list-sitemaps | submit-sitemap
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "status";
  const site = url.searchParams.get("site") ?? "https://www.precisodeum.com.br/";
  const sitemap =
    url.searchParams.get("sitemap") ?? "https://www.precisodeum.com.br/sitemap.xml";

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GSC = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");

  if (!LOVABLE_API_KEY || !GSC) {
    return json(
      {
        connected: false,
        error: "missing_credentials",
        detail: !LOVABLE_API_KEY
          ? "LOVABLE_API_KEY not configured"
          : "GOOGLE_SEARCH_CONSOLE_API_KEY not configured — connect Google Search Console first",
      },
      action === "status" ? 200 : 503,
    );
  }

  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GSC,
    "Content-Type": "application/json",
  };

  const gw = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`${GATEWAY}${path}`, { ...init, headers });
    const text = await r.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (_) {
      // keep as text
    }
    return { ok: r.ok, status: r.status, data: parsed };
  };

  try {
    if (action === "status") {
      const sites = await gw("/webmasters/v3/sites");
      let verified: unknown = null;
      let owned = false;
      if (sites.ok && Array.isArray((sites.data as any)?.siteEntry)) {
        const entry = (sites.data as any).siteEntry.find(
          (s: any) => s.siteUrl === site,
        );
        owned = !!entry;
        verified = entry ?? null;
      }
      return json({
        connected: true,
        site,
        owned,
        verified,
        sites: (sites.data as any)?.siteEntry ?? [],
        sites_status: sites.status,
      });
    }

    if (action === "get-token") {
      const r = await gw("/siteVerification/v1/token", {
        method: "POST",
        body: JSON.stringify({
          site: { identifier: site, type: "SITE" },
          verificationMethod: "META",
        }),
      });
      return json(r.data, r.status);
    }

    if (action === "verify") {
      const r = await gw(
        "/siteVerification/v1/webResource?verificationMethod=META",
        {
          method: "POST",
          body: JSON.stringify({ site: { identifier: site, type: "SITE" } }),
        },
      );
      return json(r.data, r.status);
    }

    if (action === "add") {
      const r = await gw(`/webmasters/v3/sites/${encodeURIComponent(site)}`, {
        method: "PUT",
      });
      return json(r.data ?? { ok: r.ok }, r.status);
    }

    if (action === "list") {
      const r = await gw("/webmasters/v3/sites");
      return json(r.data, r.status);
    }

    if (action === "list-sitemaps") {
      const r = await gw(
        `/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps`,
      );
      return json(r.data, r.status);
    }

    if (action === "submit-sitemap") {
      const r = await gw(
        `/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemap)}`,
        { method: "PUT" },
      );
      return json(r.data ?? { ok: r.ok, sitemap }, r.status);
    }

    if (action === "delete-sitemap") {
      const r = await gw(
        `/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemap)}`,
        { method: "DELETE" },
      );
      return json(r.data ?? { ok: r.ok }, r.status);
    }

    return json({ error: "unknown_action", action }, 400);
  } catch (err) {
    return json({ error: "gateway_failure", detail: String(err) }, 502);
  }
});
