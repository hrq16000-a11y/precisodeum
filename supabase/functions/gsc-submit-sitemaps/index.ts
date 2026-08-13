// Submissão automática do sitemap index particionado ao Google Search Console.
//
// Fluxo:
//  1. Autoriza o caller (admin JWT, service_role ou x-cron-secret do CI).
//  2. Baixa o sitemap index público e extrai cada sub-sitemap <loc>.
//  3. Resolve a propriedade verificada no GSC via GET /webmasters/v3/sites.
//  4. Faz PUT em /sitemaps/{loc} para o index + cada partição.
//  5. Registra cada submissão em gsc_audit_log.
//
// Chamada típica (CI pós-build):
//   POST /functions/v1/gsc-submit-sitemaps
//   headers: x-cron-secret: $CRON_SECRET
//   body: { "site": "https://www.precisodeum.com.br/", "dryRun": false }
import { authorizeAdminOrCron } from "../_shared/adminOrCronAuth.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const DEFAULT_SITE = "https://www.precisodeum.com.br/";
const MAX_SITEMAPS = 200;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function writeAudit(entries: Array<Record<string, unknown>>) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || entries.length === 0) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/gsc_audit_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(entries),
    });
  } catch (_) {
    // auditoria nunca quebra o fluxo principal
  }
}

/** Extrai as <loc> de um sitemapindex. */
export function extractSitemapLocs(xml: string): string[] {
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)).map((m) =>
    m[1].replace(/&amp;/g, "&").trim(),
  );
  return Array.from(new Set(locs));
}

/** Escolhe a propriedade verificada que cobre a URL alvo. */
export function pickProperty(
  entries: Array<{ siteUrl: string; permissionLevel?: string }>,
  target: string,
): { status: "selected"; siteUrl: string } | { status: "none" } | {
  status: "multiple";
  candidates: string[];
} {
  let host = "";
  let href = target;
  try {
    const u = new URL(target);
    host = u.hostname.toLowerCase();
    href = u.href;
  } catch (_) {
    return { status: "none" };
  }
  const matches = entries
    .filter((e) => e.permissionLevel !== "siteUnverifiedUser")
    .filter((e) => {
      if (e.siteUrl.startsWith("sc-domain:")) {
        const d = e.siteUrl.slice("sc-domain:".length).toLowerCase();
        return host === d || host.endsWith(`.${d}`);
      }
      try {
        return href.startsWith(new URL(e.siteUrl).href);
      } catch (_) {
        return false;
      }
    })
    .map((e) => e.siteUrl);

  if (matches.length === 0) return { status: "none" };
  if (matches.length === 1) return { status: "selected", siteUrl: matches[0] };
  return { status: "multiple", candidates: matches };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authz = await authorizeAdminOrCron(req, corsHeaders);
  if (!authz.ok) return authz.response;

  let body: Record<string, unknown> = {};
  try {
    body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  } catch (_) {
    body = {};
  }

  const site = String(body.site ?? DEFAULT_SITE);
  const selectedProperty = body.property ? String(body.property) : undefined;
  const dryRun = body.dryRun === true;
  const origin = site.replace(/\/+$/, "");
  const indexUrl = String(body.sitemapIndex ?? `${origin}/sitemap.xml`);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GSC = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");
  if (!LOVABLE_API_KEY || !GSC) {
    return json(
      {
        error: "missing_credentials",
        detail:
          "Conecte o Google Search Console (GOOGLE_SEARCH_CONSOLE_API_KEY) antes de submeter sitemaps.",
      },
      503,
    );
  }

  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GSC,
    "Content-Type": "application/json",
  };

  try {
    // 1. Baixa o sitemap index e extrai as partições.
    const idxRes = await fetch(indexUrl, {
      headers: { "User-Agent": "precisodeum-sitemap-submitter/1.0" },
    });
    if (!idxRes.ok) {
      return json(
        { error: "sitemap_index_unreachable", status: idxRes.status, indexUrl },
        502,
      );
    }
    const xml = await idxRes.text();
    const partitions = extractSitemapLocs(xml).filter((u) => u.startsWith("http"));
    const targets = [indexUrl, ...partitions].slice(0, MAX_SITEMAPS);

    // 2. Resolve a propriedade verificada.
    const sitesRes = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
    const sitesText = await sitesRes.text();
    if (!sitesRes.ok) {
      return json(
        { error: "sites_list_failed", status: sitesRes.status, details: sitesText },
        sitesRes.status,
      );
    }
    const siteEntry = (JSON.parse(sitesText || "{}")?.siteEntry ?? []) as Array<
      { siteUrl: string; permissionLevel?: string }
    >;
    const resolution = pickProperty(siteEntry, site);
    let property: string;
    if (selectedProperty) {
      const valid = siteEntry.some(
        (e) => e.siteUrl === selectedProperty && e.permissionLevel !== "siteUnverifiedUser",
      );
      if (!valid) return json({ error: "property_not_verified", property: selectedProperty }, 403);
      property = selectedProperty;
    } else if (resolution.status === "selected") {
      property = resolution.siteUrl;
    } else if (resolution.status === "multiple") {
      return json(
        { error: "selection_required", candidates: resolution.candidates },
        409,
      );
    } else {
      return json({ error: "no_verified_property", site }, 404);
    }

    if (dryRun) {
      return json({ dryRun: true, property, total: targets.length, sitemaps: targets });
    }

    // 3. Submete cada sitemap (sequencial, para não estourar rate limit).
    const results: Array<{ sitemap: string; ok: boolean; status: number; error?: string }> = [];
    const auditRows: Array<Record<string, unknown>> = [];
    for (const sm of targets) {
      const r = await fetch(
        `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${
          encodeURIComponent(sm)
        }`,
        { method: "PUT", headers },
      );
      const text = await r.text();
      results.push({
        sitemap: sm,
        ok: r.ok,
        status: r.status,
        error: r.ok ? undefined : text.slice(0, 300),
      });
      auditRows.push({
        action: "submit-sitemap",
        site: property,
        sitemap: sm,
        status: r.status,
        ok: r.ok,
        response: null,
        error: r.ok ? null : text.slice(0, 500),
        triggered_by: authz.userId,
      });
      if (r.status === 403) break; // acesso negado: não insiste no lote
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, 2000));
      }
    }

    await writeAudit(auditRows);

    const failed = results.filter((r) => !r.ok);
    return json(
      {
        ok: failed.length === 0,
        property,
        submitted: results.length,
        succeeded: results.length - failed.length,
        failed: failed.length,
        results,
      },
      failed.length === 0 ? 200 : 207,
    );
  } catch (err) {
    console.error("gsc-submit-sitemaps failed:", err);
    return json({ error: "gateway_failure", detail: String(err) }, 502);
  }
});
