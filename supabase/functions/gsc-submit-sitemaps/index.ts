// Submissão automática do sitemap index particionado ao Google Search Console.
//
// Fluxo:
//  1. Autoriza o caller (admin JWT, service_role ou x-cron-secret do CI).
//  2. Baixa o sitemap index público e extrai cada sub-sitemap <loc>.
//  3. Pré-valida cada partição (HTTP 200, XML válido, sem noindex/canônico inconsistente).
//  4. Resolve a propriedade verificada (override → site_settings por ambiente → única).
//  5. Faz PUT em /sitemaps/{loc} com retry exponencial + rate limiting.
//  6. Registra cada submissão em gsc_audit_log.
//
// Body opcional:
//   { site, property, environment: 'prod'|'staging'|'dev', dryRun, validateOnly, skipInvalid }
import { authorizeAdminOrCron } from "../_shared/adminOrCronAuth.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const DEFAULT_SITE = "https://www.precisodeum.com.br/";
const MAX_SITEMAPS = 200;

// Rate limiting / retry
const REQUEST_INTERVAL_MS = 600; // ~1.6 req/s contra o gateway
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 800;
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

const PROPERTY_SETTING_KEYS: Record<string, string> = {
  prod: "gsc_property_prod",
  staging: "gsc_property_staging",
  dev: "gsc_property_dev",
};

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function readSetting(key: string): Promise<string | null> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?select=value&key=eq.${encodeURIComponent(key)}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    const raw = rows?.[0]?.value;
    if (raw == null) return null;
    return typeof raw === "string" ? raw.replace(/^"|"$/g, "") : String(raw);
  } catch (_) {
    return null;
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
):
  | { status: "selected"; siteUrl: string }
  | { status: "none" }
  | { status: "multiple"; candidates: string[] } {
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

export type ValidationResult = {
  sitemap: string;
  ok: boolean;
  status: number | null;
  urlCount: number;
  issues: string[];
};

/** Valida o XML de um sub-sitemap (puro, testável). */
export function validateSitemapXml(
  sitemap: string,
  status: number | null,
  contentType: string | null,
  xml: string,
): ValidationResult {
  const issues: string[] = [];
  if (status !== 200) issues.push(`HTTP ${status ?? "sem resposta"}`);
  if (contentType && !/xml/i.test(contentType)) {
    issues.push(`content-type inesperado: ${contentType}`);
  }
  const isUrlset = /<urlset[\s>]/i.test(xml);
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  if (!isUrlset && !isIndex) issues.push("XML não contém <urlset> nem <sitemapindex>");

  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)).map((m) => m[1]);
  if (locs.length === 0) issues.push("sitemap sem URLs (<loc> vazio)");
  if (locs.some((l) => !/^https:\/\//i.test(l))) {
    issues.push("URLs sem https (canônico inconsistente)");
  }
  if (/noindex/i.test(xml)) issues.push("marcação noindex encontrada no XML");

  return { sitemap, ok: issues.length === 0, status, urlCount: locs.length, issues };
}

async function validateSitemap(url: string): Promise<ValidationResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "precisodeum-sitemap-validator/1.0" },
    });
    const text = await res.text();
    return validateSitemapXml(url, res.status, res.headers.get("content-type"), text);
  } catch (err) {
    return {
      sitemap: url,
      ok: false,
      status: null,
      urlCount: 0,
      issues: [`falha de rede: ${String(err)}`],
    };
  }
}

/** PUT no gateway com retry exponencial (jitter) para status transitórios. */
async function submitWithRetry(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: string; attempts: number }> {
  let attempt = 0;
  let last = { ok: false, status: 0, body: "" };
  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      const r = await fetch(url, { method: "PUT", headers });
      const body = await r.text();
      last = { ok: r.ok, status: r.status, body };
      if (r.ok || !RETRYABLE.has(r.status)) break;
      const retryAfter = Number(r.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
      if (attempt < MAX_RETRIES) await sleep(wait);
    } catch (err) {
      last = { ok: false, status: 0, body: String(err) };
      if (attempt < MAX_RETRIES) await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }
  }
  return { ...last, attempts: attempt };
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
  const environment = ["prod", "staging", "dev"].includes(String(body.environment))
    ? String(body.environment)
    : "prod";
  const overrideProperty = body.property ? String(body.property) : undefined;
  const dryRun = body.dryRun === true;
  const validateOnly = body.validateOnly === true;
  const skipInvalid = body.skipInvalid !== false; // default: pula partições inválidas
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
    const candidates = [indexUrl, ...partitions].slice(0, MAX_SITEMAPS);

    // 2. Pré-validação (paralelismo controlado em lotes de 5).
    const validations: ValidationResult[] = [];
    for (let i = 0; i < candidates.length; i += 5) {
      const batch = candidates.slice(i, i + 5);
      validations.push(...(await Promise.all(batch.map(validateSitemap))));
    }
    const invalid = validations.filter((v) => !v.ok);
    const targets = skipInvalid
      ? validations.filter((v) => v.ok).map((v) => v.sitemap)
      : candidates;

    if (validateOnly) {
      return json({
        validateOnly: true,
        total: candidates.length,
        valid: validations.length - invalid.length,
        invalid: invalid.length,
        validations,
      });
    }

    // 3. Resolve a propriedade verificada.
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
    const verified = siteEntry.filter((e) => e.permissionLevel !== "siteUnverifiedUser");
    const configured = await readSetting(PROPERTY_SETTING_KEYS[environment]);

    let property: string;
    if (overrideProperty) {
      if (!verified.some((e) => e.siteUrl === overrideProperty)) {
        return json({ error: "property_not_verified", property: overrideProperty }, 403);
      }
      property = overrideProperty;
    } else if (configured && verified.some((e) => e.siteUrl === configured)) {
      property = configured;
    } else {
      const resolution = pickProperty(siteEntry, site);
      if (resolution.status === "selected") property = resolution.siteUrl;
      else if (resolution.status === "multiple") {
        return json(
          { error: "selection_required", environment, candidates: resolution.candidates },
          409,
        );
      } else return json({ error: "no_verified_property", site }, 404);
    }

    if (dryRun) {
      return json({
        dryRun: true,
        environment,
        property,
        total: targets.length,
        skipped: invalid.length,
        validations,
        sitemaps: targets,
      });
    }

    // 4. Submete com rate limiting + retry.
    const results: Array<
      { sitemap: string; ok: boolean; status: number; attempts: number; error?: string }
    > = [];
    const auditRows: Array<Record<string, unknown>> = [];

    for (const sm of targets) {
      const r = await submitWithRetry(
        `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${
          encodeURIComponent(sm)
        }`,
        headers,
      );
      results.push({
        sitemap: sm,
        ok: r.ok,
        status: r.status,
        attempts: r.attempts,
        error: r.ok ? undefined : r.body.slice(0, 300),
      });
      auditRows.push({
        action: "submit-sitemap",
        site: property,
        sitemap: sm,
        status: r.status,
        ok: r.ok,
        response: { attempts: r.attempts, environment },
        error: r.ok ? null : r.body.slice(0, 500),
        triggered_by: authz.userId,
      });
      if (r.status === 403) break; // acesso negado: não insiste no lote
      await sleep(REQUEST_INTERVAL_MS);
    }

    await writeAudit(auditRows);

    const failed = results.filter((x) => !x.ok);
    return json(
      {
        ok: failed.length === 0 && invalid.length === 0,
        environment,
        property,
        submitted: results.length,
        succeeded: results.length - failed.length,
        failed: failed.length,
        skippedInvalid: skipInvalid ? invalid.length : 0,
        validations: invalid,
        results,
      },
      failed.length === 0 ? 200 : 207,
    );
  } catch (err) {
    console.error("gsc-submit-sitemaps failed:", err);
    return json({ error: "gateway_failure", detail: String(err) }, 502);
  }
});
