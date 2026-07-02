/**
 * Valida que a requisição veio de uma edge function interna
 * usando a service_role key no Authorization header.
 *
 * Uso: no início de funções internas-only:
 *   const authError = validateServiceRoleRequest(req);
 *   if (authError) return authError;
 *
 * Comportamento (fail-closed):
 * - Sem SUPABASE_SERVICE_ROLE_KEY no ambiente: 500 not_configured.
 * - Authorization ausente ou diferente da service_role: 401 unauthorized.
 * - Match exato: retorna null (autorizado).
 */
export function validateServiceRoleRequest(req: Request): Response | null {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    console.error("[serviceRoleAuth] SUPABASE_SERVICE_ROLE_KEY not configured");
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const incoming = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (incoming !== serviceRoleKey) {
    console.warn("[serviceRoleAuth] unauthorized call to internal function");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
