/**
 * Valida que a requisição veio do scheduler interno do Supabase
 * ou de um caller autorizado com o header x-cron-secret.
 *
 * Uso: no início de cada cron handler:
 *   const authError = validateCronRequest(req);
 *   if (authError) return authError;
 *
 * Comportamento:
 * - Sem CRON_SECRET configurado: bloqueia (fail-closed) e retorna 500.
 * - Header `x-cron-secret` ausente ou diferente: 401 unauthorized.
 * - Match exato: retorna null (autorizado).
 *
 * Aceita também `?secret=` na query string como fallback compatível
 * com schedulers legados (pg_cron antigo, GitHub Actions etc.).
 */
export function validateCronRequest(req: Request): Response | null {
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (!cronSecret) {
    console.error("[cronAuth] CRON_SECRET not configured — blocking request");
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headerSecret = req.headers.get("x-cron-secret");
  let querySecret: string | null = null;
  try {
    querySecret = new URL(req.url).searchParams.get("secret");
  } catch {
    /* ignore */
  }

  if (headerSecret !== cronSecret && querySecret !== cronSecret) {
    console.warn("[cronAuth] unauthorized cron call rejected");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
