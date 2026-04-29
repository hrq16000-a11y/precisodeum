// Edge function: resend-webhook
// Recebe eventos do Resend (delivered, bounced, complained, opened, clicked)
// e registra em email_events para auditoria.
// Configure no painel do Resend: https://resend.com/webhooks
// URL: https://<project-ref>.supabase.co/functions/v1/resend-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    // Verificação opcional do secret (Svix). Configure RESEND_WEBHOOK_SECRET para ativar.
    const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    const rawBody = await req.text();

    if (secret) {
      const sig = req.headers.get("svix-signature");
      const id = req.headers.get("svix-id");
      const ts = req.headers.get("svix-timestamp");
      if (!sig || !id || !ts) {
        return new Response(JSON.stringify({ error: "Assinatura ausente" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Validação simplificada — Svix usa HMAC SHA-256 com secret base64.
      try {
        const secretBytes = Uint8Array.from(
          atob(secret.replace(/^whsec_/, "")),
          (c) => c.charCodeAt(0),
        );
        const data = new TextEncoder().encode(`${id}.${ts}.${rawBody}`);
        const key = await crypto.subtle.importKey(
          "raw",
          secretBytes,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const mac = await crypto.subtle.sign("HMAC", key, data);
        const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
        const provided = sig.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
        if (!provided.includes(expected)) {
          return new Response(JSON.stringify({ error: "Assinatura inválida" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("svix verify error", e);
      }
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
