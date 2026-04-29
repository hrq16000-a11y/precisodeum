// Edge function: send-email
// Envia e-mails transacionais via Resend usando o Lovable Connector Gateway.
// Inputs: { to: string|string[]; subject: string; html?: string; text?: string; from?: string; reply_to?: string; tags?: {name:string;value:string}[] }
// Output: { id: string }
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const BodySchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1).max(50)]),
  subject: z.string().min(1).max(255),
  html: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  from: z.string().min(3).max(255).optional(),
  reply_to: z.string().email().optional(),
  tags: z
    .array(z.object({ name: z.string().min(1), value: z.string().min(1) }))
    .max(20)
    .optional(),
}).refine((b) => !!(b.html || b.text), { message: "html ou text é obrigatório" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return json({ error: "Método não permitido" }, 405);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
    }
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return json({ error: "RESEND_API_KEY não configurada" }, 500);
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(
        { error: "Payload inválido", details: parsed.error.flatten().fieldErrors },
        400,
      );
    }
    const body = parsed.data;

    const payload = {
      from: body.from || "Preciso de Um <onboarding@resend.dev>",
      to: Array.isArray(body.to) ? body.to : [body.to],
      subject: body.subject,
      html: body.html,
      text: body.text,
      reply_to: body.reply_to,
      tags: body.tags,
    };

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
      console.error("Resend gateway error", res.status, data);
      return json(
        { error: "Falha ao enviar e-mail", status: res.status, details: data },
        502,
      );
    }

    return json({ id: data.id ?? null, ok: true }, 200);
  } catch (err) {
    console.error("send-email error", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
