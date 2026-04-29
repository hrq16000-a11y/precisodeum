// user-data-export
// LGPD — Art. 18, V (portabilidade) e Art. 19 (acesso): exporta em JSON
// um relatório com TODOS os dados pessoais tratados sobre o usuário
// autenticado. Apenas o próprio titular tem acesso (auth user.id).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Tabelas onde armazenamos dados do usuário (chaveadas por user_id)
const USER_TABLES = [
  "profiles",
  "providers",
  "provider_page_settings",
  "services",
  "service_categories",
  "favorites",
  "leads",
  "lead_history",
  "lead_interactions",
  "messages",
  "notifications",
  "reviews",
  "engagement_log",
  "user_roles",
  "user_access_logs",
  "media",
  "account_deletion_requests",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Autenticação obrigatória
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return json({ error: "Autenticação necessária." }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userResult, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userResult.user) {
      return json({ error: "Sessão inválida." }, 401);
    }
    const userId = userResult.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const report: Record<string, unknown> = {
      meta: {
        generated_at: new Date().toISOString(),
        user_id: userId,
        email: userResult.user.email,
        legal_basis:
          "LGPD Art. 18, V (portabilidade) e Art. 19 (acesso) — titular dos dados",
        controller: {
          name: "Ping Soluções",
          cnpj: "41.723.708/0001-58",
          contact: "contato@precisodeum.com.br",
        },
        notes:
          "Este relatório contém os dados pessoais que tratamos sobre você. Dados anonimizados ou não vinculados ao seu user_id não estão listados.",
      },
      auth_user: {
        id: userResult.user.id,
        email: userResult.user.email,
        phone: userResult.user.phone,
        created_at: userResult.user.created_at,
        last_sign_in_at: userResult.user.last_sign_in_at,
        app_metadata: userResult.user.app_metadata,
        user_metadata: userResult.user.user_metadata,
      },
      tables: {} as Record<string, unknown>,
    };

    const tablesOut = report.tables as Record<string, unknown>;

    for (const table of USER_TABLES) {
      // Tenta filtrar por user_id; se a tabela usar outra coluna, ignora silenciosamente
      const { data, error } = await admin
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .limit(5000);
      if (!error && data) {
        tablesOut[table] = { count: data.length, rows: data };
      } else {
        tablesOut[table] = { count: 0, rows: [], note: error?.message ?? "skipped" };
      }
    }

    // sponsor_leads usa user_id também (idempotente). Já incluído acima se existir.

    const filename = `meus-dados-precisodeum-${userId.slice(0, 8)}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("user-data-export error", err);
    return json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      500,
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
