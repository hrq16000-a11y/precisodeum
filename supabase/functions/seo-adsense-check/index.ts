// Verificação server-side da integração AdSense por rota.
// Baixa o HTML servido de cada rota e reporta meta/script/blocos <ins> ausentes
// ou inconsistentes, além de checar /ads.txt.
//
// Auth: admin JWT, service_role ou x-cron-secret (mesma política do submitter).
import { authorizeAdminOrCron } from "../_shared/adminOrCronAuth.ts";

const DEFAULT_BASE = "https://www.precisodeum.com.br";
const DEFAULT_PUBLISHER = "ca-pub-3762170279587706";
const DEFAULT_ROUTES = ["/", "/buscar", "/especialidades", "/como-funciona", "/blog"];
const MAX_ROUTES = 40;

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

const META_RE =
  /<meta[^>]+name=["']google-adsense-account["'][^>]*content=["']([^"']+)["'][^>]*>/i;
const SCRIPT_RE =
  /<script([^>]*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*)>/i;
const CLIENT_IN_SRC_RE = /client=(ca-pub-[0-9]+)/i;
const INS_RE = /<ins\b[^>]*class=["'][^"']*adsbygoogle[^"']*["'][^>]*>/gi;

function analyze(route: string, html: string, status: number | null, publisher: string) {
  const issues: Array<{ code: string; level: "error" | "warning"; message: string }> = [];
  const metaClient = html.match(META_RE)?.[1] ?? null;
  if (!metaClient) {
    issues.push({ code: "meta_missing", level: "error", message: 'Meta "google-adsense-account" ausente.' });
  } else if (metaClient !== publisher) {
    issues.push({
      code: "meta_client_mismatch",
      level: "error",
      message: `Meta aponta para ${metaClient} (esperado ${publisher}).`,
    });
  }

  const scriptAttrs = html.match(SCRIPT_RE)?.[1] ?? null;
  const scriptClient = scriptAttrs?.match(CLIENT_IN_SRC_RE)?.[1] ?? null;
  if (scriptAttrs == null) {
    issues.push({ code: "script_missing", level: "error", message: "Script adsbygoogle.js não encontrado." });
  } else {
    if (scriptClient && scriptClient !== publisher) {
      issues.push({
        code: "script_client_mismatch",
        level: "error",
        message: `Script usa client ${scriptClient} (esperado ${publisher}).`,
      });
    }
    if (!/\basync\b/i.test(scriptAttrs)) {
      issues.push({ code: "script_not_async", level: "warning", message: "Script sem async (impacta LCP)." });
    }
    if (!/crossorigin=["']anonymous["']/i.test(scriptAttrs)) {
      issues.push({
        code: "script_missing_crossorigin",
        level: "warning",
        message: 'Script sem crossorigin="anonymous".',
      });
    }
  }

  const insBlocks = html.match(INS_RE) ?? [];
  for (const ins of insBlocks) {
    if (!/data-ad-client=/i.test(ins)) {
      issues.push({ code: "ins_without_client", level: "error", message: "<ins> adsbygoogle sem data-ad-client." });
    }
    if (!/data-ad-slot=/i.test(ins)) {
      issues.push({ code: "ins_without_slot", level: "warning", message: "<ins> adsbygoogle sem data-ad-slot." });
    }
  }

  return {
    route,
    httpStatus: status,
    ok: status === 200 && !issues.some((i) => i.level === "error"),
    metaClient,
    scriptClient,
    insBlocks: insBlocks.length,
    issues,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authz = await authorizeAdminOrCron(req, corsHeaders);
  if (!authz.ok) return authz.response;

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const base = String(body?.base ?? DEFAULT_BASE).replace(/\/+$/, "");
  const publisher = String(body?.publisher ?? DEFAULT_PUBLISHER);
  const routes: string[] = Array.isArray(body?.routes) && body.routes.length
    ? body.routes.map(String).slice(0, MAX_ROUTES)
    : DEFAULT_ROUTES;

  try {
    const reports = [];
    for (let i = 0; i < routes.length; i += 4) {
      const batch = routes.slice(i, i + 4);
      const chunk = await Promise.all(
        batch.map(async (route) => {
          const url = `${base}${route.startsWith("/") ? route : `/${route}`}`;
          try {
            const res = await fetch(url, {
              headers: { "User-Agent": "precisodeum-adsense-check/1.0" },
            });
            const html = await res.text();
            return analyze(route, html, res.status, publisher);
          } catch (err) {
            return {
              route,
              httpStatus: null,
              ok: false,
              metaClient: null,
              scriptClient: null,
              insBlocks: 0,
              issues: [{ code: "fetch_failed", level: "error" as const, message: String(err) }],
            };
          }
        }),
      );
      reports.push(...chunk);
    }

    // ads.txt
    let adsTxt: { ok: boolean; status: number | null; hasPublisher: boolean } = {
      ok: false,
      status: null,
      hasPublisher: false,
    };
    try {
      const r = await fetch(`${base}/ads.txt`);
      const text = await r.text();
      const pubId = publisher.replace(/^ca-/, "");
      adsTxt = { ok: r.ok, status: r.status, hasPublisher: text.includes(pubId) };
    } catch (_) {
      // mantém default
    }

    const errorCount = reports.filter((r) => r.issues.some((i) => i.level === "error")).length;
    const warningCount = reports.filter(
      (r) => !r.issues.some((i) => i.level === "error") && r.issues.length > 0,
    ).length;

    return json({
      base,
      publisher,
      checkedAt: new Date().toISOString(),
      summary: { total: reports.length, errorCount, warningCount, adsTxt },
      reports,
    });
  } catch (err) {
    console.error("seo-adsense-check failed:", err);
    return json({ error: "check_failed", detail: String(err) }, 500);
  }
});
