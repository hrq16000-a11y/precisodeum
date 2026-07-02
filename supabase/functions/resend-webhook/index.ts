// Edge function: resend-webhook
// Recebe eventos do Resend (delivered, bounced, complained, opened, clicked)
// e registra em email_events para auditoria.
// Configure no painel do Resend: https://resend.com/webhooks
// URL: https://<project-ref>.supabase.co/functions/v1/resend-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateResendWebhook } from "../_shared/webhookAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, svix-id, svix-signature, svix-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Lê o body UMA vez (stream consumível) — necessário para validar HMAC
    // antes de fazer JSON.parse.
    const rawBody = await req.text();

    // Validação fail-closed: sem secret configurado retorna 500;
    // headers ausentes / timestamp fora da janela / assinatura inválida → 401.
    const authError = await validateResendWebhook(req, rawBody);
    if (authError) {
      // Reaplica corsHeaders na resposta (helper só seta Content-Type).
      return new Response(authError.body, {
        status: authError.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evt = JSON.parse(rawBody);
    const type: string = evt?.type ?? "unknown";
    const data = evt?.data ?? {};
    const messageId = data.email_id ?? data.id ?? null;
    const recipient = Array.isArray(data.to) ? data.to[0] : data.to ?? null;
    const subject = data.subject ?? null;
    const tags: Array<{ name: string; value: string }> = data.tags ?? [];
    const template = tags.find((t) => t.name === "type")?.value ?? null;

    const { error } = await supabase.from("email_events").insert({
      provider: "resend",
      message_id: messageId,
      event_type: type,
      recipient,
      subject,
      template,
      payload: evt,
      occurred_at: data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString(),
    });
    if (error) console.error("insert email_event error", error);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("resend-webhook error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
