// Edge function: notify-auth-errors
// Recebe payload de Database Webhook (INSERT em onboarding_events) e
// envia alerta por e-mail (Resend) apenas para erros críticos.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CRITICAL_CODES = new Set([
  "C_RLS_403",
  "B_PROFILE_NULL_HEAL_FAIL",
]);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALERT_TO = Deno.env.get("AUTH_ALERT_EMAIL_TO");
const SITE_URL =
  Deno.env.get("SITE_URL") ?? "https://precisodeum.com.br";

interface OnboardingEventRow {
  id?: string;
  user_id?: string | null;
  event?: string | null;
  phase?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
}

function extractRecord(payload: unknown): OnboardingEventRow | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  // Supabase DB webhook → { type, table, record, old_record, schema }
  if (p.record && typeof p.record === "object") {
    return p.record as OnboardingEventRow;
  }
  // Chamada direta (debug)
  if (p.event || p.error_code) return p as OnboardingEventRow;
  return null;
}

function buildHtml(row: OnboardingEventRow): { subject: string; html: string } {
  const code = row.error_code ?? "unknown";
  const subject = `[precisodeum] Alerta crítico: ${code}`;
  const dashboardUrl = `${SITE_URL}/admin/health-check`;
  const userId = row.user_id ?? "(sem user_id)";
  const message = row.error_message ?? "(sem mensagem)";
  const phase = row.phase ?? "—";
  const when = row.created_at ?? new Date().toISOString();

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; color:#111827; max-width:560px;">
      <h2 style="color:#b91c1c; margin:0 0 12px;">Alerta crítico de autenticação</h2>
      <p style="margin:0 0 16px; color:#374151;">
        Um evento crítico foi registrado em <strong>onboarding_events</strong>.
      </p>
      <table style="border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280;">Código</td><td><strong>${code}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280;">User ID</td><td><code>${userId}</code></td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280;">Fase</td><td>${phase}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280;">Quando</td><td>${when}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#6b7280; vertical-align:top;">Mensagem</td><td>${message}</td></tr>
      </table>
      <p style="margin:24px 0 0;">
        <a href="${dashboardUrl}" style="background:#b91c1c; color:#fff; padding:10px 16px; border-radius:6px; text-decoration:none;">
          Abrir painel /admin/health-check
        </a>
      </p>
    </div>
  `.trim();

  return { subject, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY || !ALERT_TO) {
      return new Response(
        JSON.stringify({ error: "missing_env", need: ["RESEND_API_KEY", "AUTH_ALERT_EMAIL_TO"] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Autenticação da chamada (fail-closed) ────────────────────────────
    // Preferencial: assinatura HMAC-SHA256 com timestamp (anti-replay ±5 min)
    //   headers: x-webhook-timestamp + x-webhook-signature: v1=<hex>
    //   segredos aceitos (rotação sem downtime):
    //     NOTIFY_AUTH_WEBHOOK_SECRET, _PREVIOUS, _NEXT
    // Compatibilidade: Database Webhooks internos com Bearer service role key.
    // Sem nenhum dos dois → 401.
    const rawBody = await req.text();
    const auth = await verifyRotatingWebhook(req, rawBody, {
      prefix: "NOTIFY_AUTH_WEBHOOK_SECRET",
      allowServiceRole: true,
    });
    if (!auth.ok) {
      console.warn("[notify-auth-errors] rejected:", auth.error);
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`[notify-auth-errors] authorized via=${auth.via} key=${auth.keyVersion}`);

    const body = (() => {
      try { return JSON.parse(rawBody); } catch { return null; }
    })();
    const row = extractRecord(body);
    if (!row) {
      return new Response(JSON.stringify({ skipped: "no_record" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-spoof: só envia e-mail se o evento realmente existir no banco.
    if (row.id) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      if (SUPABASE_URL && SERVICE_KEY) {
        const check = await fetch(
          `${SUPABASE_URL}/rest/v1/onboarding_events?id=eq.${encodeURIComponent(row.id)}&select=id,event,error_code,error_message,phase,user_id,created_at`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
        );
        const rows = (await check.json().catch(() => [])) as OnboardingEventRow[];
        if (!Array.isArray(rows) || rows.length === 0) {
          return new Response(JSON.stringify({ skipped: "event_not_found" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        Object.assign(row, rows[0]); // usa os valores do banco, não do payload
      }
    }

    if (row.event !== "error" || !row.error_code || !CRITICAL_CODES.has(row.error_code)) {
      return new Response(
        JSON.stringify({ skipped: "not_critical", code: row.error_code ?? null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const { subject, html } = buildHtml(row);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Auth Alerts <onboarding@resend.dev>",
        to: [ALERT_TO],
        subject,
        html,
      }),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("[notify-auth-errors] resend_failed", resp.status, text);
      return new Response(
        JSON.stringify({ error: "resend_failed", status: resp.status, body: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, code: row.error_code }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-auth-errors] unexpected", err);
    return new Response(
      JSON.stringify({ error: "unexpected", message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
