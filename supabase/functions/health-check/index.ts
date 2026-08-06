/**
 * health-check — verificação pública de integridade pós-deploy.
 *
 * GET /functions/v1/health-check
 *   → { status, version, checks: [{ name, ok, status, latency_ms, detail }] }
 *
 * Checagens:
 *   auth        → GoTrue /auth/v1/health responde 200
 *   gsc_verify  → edge gsc-verify recusa chamada anônima (401/403 = saudável)
 *   search      → REST consegue ler 1 provider aprovado (Data API + RLS ok)
 *   sitemap     → /sitemap.xml responde 200 e começa com XML
 *
 * Não expõe segredos nem dados de usuário. Logs básicos por checagem.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://precisodeum.com.br";

type Check = {
  name: string;
  ok: boolean;
  status: number | null;
  latency_ms: number;
  detail?: string;
};

async function timed(name: string, fn: () => Promise<Omit<Check, "name" | "latency_ms">>): Promise<Check> {
  const started = performance.now();
  try {
    const result = await fn();
    return { name, latency_ms: Math.round(performance.now() - started), ...result };
  } catch (err) {
    return {
      name,
      ok: false,
      status: null,
      latency_ms: Math.round(performance.now() - started),
      detail: (err as Error).message?.slice(0, 200),
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const checks: Check[] = [];

  checks.push(
    await timed("auth", async () => {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: ANON_KEY },
      });
      return { ok: res.ok, status: res.status };
    }),
  );

  checks.push(
    await timed("gsc_verify", async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gsc-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status" }),
      });
      // Saudável = fechado para anônimo.
      const closed = res.status === 401 || res.status === 403;
      return {
        ok: closed,
        status: res.status,
        detail: closed ? "fechado para anônimo" : "ATENÇÃO: rota deveria recusar anônimo",
      };
    }),
  );

  checks.push(
    await timed("search", async () => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/providers?select=id&status=eq.approved&limit=1`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
      );
      const rows = res.ok ? await res.json().catch(() => null) : null;
      return {
        ok: res.ok && Array.isArray(rows),
        status: res.status,
        detail: Array.isArray(rows) ? `${rows.length} registro(s)` : undefined,
      };
    }),
  );

  checks.push(
    await timed("public_profiles", async () => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/public_profiles?select=id&limit=1`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
      );
      const rows = res.ok ? await res.json().catch(() => null) : null;
      return {
        ok: res.ok && Array.isArray(rows),
        status: res.status,
        detail: res.ok ? "view pública legível" : "leitura pública de perfis falhou",
      };
    }),
  );

  checks.push(
    await timed("profiles_closed", async () => {
      // profiles NÃO pode ser legível por anônimo (PII). 401/403 ou 0 linhas = saudável.
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
      );
      const rows = res.ok ? await res.json().catch(() => null) : null;
      const closed = !res.ok || (Array.isArray(rows) && rows.length === 0);
      return {
        ok: closed,
        status: res.status,
        detail: closed ? "fechado para anônimo" : "ATENÇÃO: profiles vazando para anônimo",
      };
    }),
  );

  checks.push(
    await timed("sitemap", async () => {
      const res = await fetch(`${SITE_URL}/sitemap.xml`, { redirect: "follow" });
      const head = res.ok ? (await res.text()).slice(0, 80) : "";
      return {
        ok: res.ok && head.includes("<"),
        status: res.status,
        detail: res.ok ? "XML servido" : undefined,
      };
    }),
  );

  const failed = checks.filter((c) => !c.ok);
  const status = failed.length === 0 ? "ok" : failed.length === checks.length ? "down" : "degraded";

  console.log(
    `[health-check] status=${status} ` +
      checks.map((c) => `${c.name}=${c.ok ? "ok" : "fail"}(${c.status ?? "-"}/${c.latency_ms}ms)`).join(" "),
  );

  return new Response(
    JSON.stringify({
      status,
      checked_at: new Date().toISOString(),
      site_url: SITE_URL,
      checks,
    }),
    {
      status: status === "down" ? 503 : 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
});
