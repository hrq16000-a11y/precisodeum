// Edge function: send-email
// Envia e-mails transacionais via Resend (gateway).
// Inputs:
//   { to, subject, html?, text?, from?, reply_to?, tags? }
//   OU { to, template: 'welcome'|'new_lead'|'password_reset', vars: {...}, tags? }
// Output: { ok: true, id }
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { renderTemplate, type TemplateName } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FALLBACK_FROM = "Preciso de Um <onboarding@resend.dev>";
const FALLBACK_REPLY_TO = "contato@precisodeum.com.br";

const TemplatePayload = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1).max(50)]),
  template: z.enum(["welcome", "new_lead", "password_reset"]),
  vars: z.record(z.union([z.string(), z.number(), z.null()])).default({}),
  subject: z.string().min(1).max(255).optional(),
  from: z.string().min(3).max(255).optional(),
  reply_to: z.string().email().optional(),
  tags: z.array(z.object({ name: z.string().min(1), value: z.string().min(1) })).max(20).optional(),
});

const RawPayload = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1).max(50)]),
  subject: z.string().min(1).max(255),
  html: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  from: z.string().min(3).max(255).optional(),
  reply_to: z.string().email().optional(),
  tags: z.array(z.object({ name: z.string().min(1), value: z.string().min(1) })).max(20).optional(),
}).refine((b) => !!(b.html || b.text), { message: "html ou text é obrigatório" });

export async function loadDefaults(): Promise<{ from: string; reply_to: string }> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) return { from: FALLBACK_FROM, reply_to: FALLBACK_REPLY_TO };
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", ["email_from", "email_reply_to"]);
    const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
    const fromRaw = map.get("email_from");
    const replyRaw = map.get("email_reply_to");
    return {
      from: typeof fromRaw === "string" && fromRaw.length > 2 ? fromRaw : FALLBACK_FROM,
      reply_to: typeof replyRaw === "string" && replyRaw.includes("@") ? replyRaw : FALLBACK_REPLY_TO,
    };
  } catch {
    return { from: FALLBACK_FROM, reply_to: FALLBACK_REPLY_TO };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY não configurada" }, 500);

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return json({ error: "Payload inválido", details: { _root: ["JSON obrigatório"] } }, 400);
  }

  let subject: string;
  let html: string | undefined;
  let text: string | undefined;
  let to: string | string[];
  let from: string | undefined;
  let reply_to: string | undefined;
  let tags: Array<{ name: string; value: string }> | undefined;

  if ((raw as any).template) {
    const parsed = TemplatePayload.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "Payload inválido", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const tpl = renderTemplate(parsed.data.template as TemplateName, parsed.data.vars);
    subject = parsed.data.subject ?? tpl.subject;
    html = tpl.html;
    text = tpl.text;
    to = parsed.data.to;
    from = parsed.data.from;
    reply_to = parsed.data.reply_to;
    tags = [
      ...(parsed.data.tags ?? []),
      { name: "type", value: parsed.data.template },
    ];
  } else {
    const parsed = RawPayload.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "Payload inválido", details: parsed.error.flatten().fieldErrors }, 400);
    }
    ({ subject, html, text, to, from, reply_to, tags } = parsed.data);
  }

  const defaults = await loadDefaults();
  const payload = {
    from: from || defaults.from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
    reply_to: reply_to || defaults.reply_to,
    tags,
  };

  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[send-email] gateway error", res.status, JSON.stringify(data).slice(0, 500));
      return json({ error: "Falha ao enviar e-mail", status: res.status, details: data }, 502);
    }
    console.log("[send-email] sent", { id: (data as any).id, template: tags?.find((t) => t.name === "type")?.value });
    return json({ ok: true, id: (data as any).id ?? null }, 200);
  } catch (err) {
    console.error("[send-email] fetch error", err);
    return json({ error: err instanceof Error ? err.message : "Erro" }, 500);
  }
}

Deno.serve(handle);
