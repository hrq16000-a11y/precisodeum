// One-off helper to verify the site in Google Search Console.
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "verify";
  const site = url.searchParams.get("site") ?? "https://www.precisodeum.com.br/";

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GSC = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");
  if (!LOVABLE_API_KEY) return new Response("missing LOVABLE_API_KEY", { status: 500 });
  if (!GSC) return new Response("missing GOOGLE_SEARCH_CONSOLE_API_KEY", { status: 500 });

  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GSC,
    "Content-Type": "application/json",
  };

  let target = "";
  let method = "POST";
  let body: string | undefined;

  if (action === "verify") {
    target = `${GATEWAY}/siteVerification/v1/webResource?verificationMethod=META`;
    body = JSON.stringify({ site: { identifier: site, type: "SITE" } });
  } else if (action === "add") {
    target = `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(site)}`;
    method = "PUT";
  } else if (action === "list") {
    target = `${GATEWAY}/webmasters/v3/sites`;
    method = "GET";
  } else if (action === "submit-sitemap") {
    const sitemap = url.searchParams.get("sitemap") ?? "https://www.precisodeum.com.br/sitemap.xml";
    target = `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemap)}`;
    method = "PUT";
  } else {
    return new Response("unknown action", { status: 400 });
  }

  const r = await fetch(target, { method, headers, body });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { "Content-Type": "application/json" } });
});
