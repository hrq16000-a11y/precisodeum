// Google Search Console helper + audit log.
// Actions: status | get-token | verify | add | list | list-sitemaps | submit-sitemap | delete-sitemap
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

const AUDIT_ACTIONS = new Set([
  "verify",
  "add",
  "submit-sitemap",
  "delete-sitemap",
  "get-token",
]);

async function writeAudit(entry: {
  action: string;
  site?: string;
  sitemap?: string;
  status?: number;
  ok: boolean;
  response?: unknown;
  error?: string;
  triggered_by?: string | null;
}) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    // Trim large payloads to keep the log light.
    const responseStr =
      entry.response == null
        ? null
        : typeof entry.response === "string"
          ? entry.response.slice(0, 4000)
          : JSON.stringify(entry.response).slice(0, 4000);
    await fetch(`${SUPABASE_URL}/rest/v1/gsc_audit_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        action: entry.action,
        site: entry.site ?? null,
        sitemap: entry.sitemap ?? null,
        status: entry.status ?? null,
        ok: entry.ok,
        response: responseStr ? safeParse(responseStr) : null,
        error: entry.error ?? null,
        triggered_by: entry.triggered_by ?? null,
      }),
    });
  } catch (_) {
    // Audit failure must never break the main flow.
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (_) {
    return { raw: text };
  }
}

function callerId(req: Request): string | null {
  // Best-effort: pick the sub claim from the JWT without verifying — only used to attribute the log.
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload?.sub ?? null;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "status";
  const site = url.searchParams.get("site") ?? "https://www.precisodeum.com.br/";
  const sitemap =
    url.searchParams.get("sitemap") ?? "https://www.precisodeum.com.br/sitemap.xml";
  const triggered_by = callerId(req);

  // Auth: admin only. Nenhuma ação (nem leitura) fica exposta a usuários comuns.
  {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
      return json({ error: "server_misconfigured" }, 500);
    }
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "unauthorized" }, 401);
    }
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return json({ error: "forbidden" }, 403);
    }
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GSC = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");

  if (!LOVABLE_API_KEY || !GSC) {
    const error = !LOVABLE_API_KEY
      ? "LOVABLE_API_KEY not configured"
      : "GOOGLE_SEARCH_CONSOLE_API_KEY not configured — connect Google Search Console first";
    if (AUDIT_ACTIONS.has(action)) {
      await writeAudit({ action, site, sitemap, ok: false, error, triggered_by });
    }
    return json(
      { connected: false, error: "missing_credentials", detail: error },
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

  const audit = (
    extras: Partial<Parameters<typeof writeAudit>[0]> & { ok: boolean; status?: number },
  ) =>
    AUDIT_ACTIONS.has(action)
      ? writeAudit({ action, site, sitemap, triggered_by, ...extras })
      : Promise.resolve();

  try {
    if (action === "status") {
      const sites = await gw("/webmasters/v3/sites");
      let owned = false;
      let verified: unknown = null;
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
      await audit({ ok: r.ok, status: r.status, response: r.data });
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
      await audit({
        ok: r.ok,
        status: r.status,
        response: r.data,
        error: r.ok ? undefined : extractError(r.data),
      });
      return json(r.data, r.status);
    }

    if (action === "add") {
      const r = await gw(`/webmasters/v3/sites/${encodeURIComponent(site)}`, {
        method: "PUT",
      });
      await audit({
        ok: r.ok,
        status: r.status,
        response: r.data,
        error: r.ok ? undefined : extractError(r.data),
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
      await audit({
        ok: r.ok,
        status: r.status,
        response: r.data,
        error: r.ok ? undefined : extractError(r.data),
      });
      return json(r.data ?? { ok: r.ok, sitemap }, r.status);
    }

    if (action === "delete-sitemap") {
      const r = await gw(
        `/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemap)}`,
        { method: "DELETE" },
      );
      await audit({
        ok: r.ok,
        status: r.status,
        response: r.data,
        error: r.ok ? undefined : extractError(r.data),
      });
      return json(r.data ?? { ok: r.ok }, r.status);
    }

    return json({ error: "unknown_action", action }, 400);
  } catch (err) {
    const error = String(err);
    if (AUDIT_ACTIONS.has(action)) {
      await writeAudit({ action, site, sitemap, ok: false, error, triggered_by });
    }
    return json({ error: "gateway_failure", detail: error }, 502);
  }
});

function extractError(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const anyD = data as any;
  return (
    anyD?.error?.message ??
    anyD?.error_description ??
    anyD?.message ??
    undefined
  );
}
