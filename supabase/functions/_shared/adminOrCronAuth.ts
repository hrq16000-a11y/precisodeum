import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthzResult =
  | { ok: true; via: "cron" | "service_role" | "admin"; userId: string | null }
  | { ok: false; response: Response };

/**
 * Autoriza uma edge function que pode ser chamada:
 *  - pelo scheduler interno (header `x-cron-secret`);
 *  - pela service_role key;
 *  - por um admin autenticado (JWT + has_role(admin)).
 *
 * Fail-closed: qualquer outro caller recebe 401.
 * O segredo NUNCA é aceito via query string.
 */
export async function authorizeAdminOrCron(
  req: Request,
  corsHeaders: Record<string, string> = {},
): Promise<AuthzResult> {
  const deny = (status: number, error: string): AuthzResult => ({
    ok: false,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (cronSecret && providedSecret && providedSecret === cronSecret) {
    return { ok: true, via: "cron", userId: null };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return deny(401, "unauthorized");

  const token = authHeader.replace("Bearer ", "").trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceRoleKey && token === serviceRoleKey) {
    return { ok: true, via: "service_role", userId: null };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await callerClient.auth.getUser();
  if (!user) return deny(401, "unauthorized");

  const { data: isAdmin } = await callerClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (!isAdmin) return deny(403, "forbidden");

  return { ok: true, via: "admin", userId: user.id };
}
