// Edge function: request-account-deletion
// Recebe pedido público de exclusão de conta (Google Play compliance),
// registra em account_deletion_requests e envia confirmação por e-mail via Resend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const APP_NAME = "Preciso de Um";
const SUPPORT_EMAIL = "contato@precisodeum.com.br";
const SITE_URL = "https://precisodeum.com.br";

const Body = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  full_name: z.string().trim().min(2, "Nome muito curto").max(120).optional(),
  reason: z.string().trim().max(2000).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const raw = await req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) {
      return json(
        { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
        400,
      );
    }
    const { email, full_name, reason } = parsed.data;

    // Identifica usuário autenticado (se existir)
    let user_id: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await supabase.auth.getUser(token);
      user_id = data.user?.id ?? null;
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    const { data: inserted, error: insertErr } = await supabase
      .from("account_deletion_requests")
      .insert({
        email: email.toLowerCase(),
        full_name: full_name ?? null,
        reason: reason ?? null,
        user_id,
        ip_address: ip,
        user_agent: ua,
      })
      .select("id, scheduled_for")
      .single();

    if (insertErr) {
      console.error("insert deletion error", insertErr);
      return json({ error: "Não foi possível registrar a solicitação." }, 500);
    }

    // Envio de e-mail (best-effort — não bloqueia a confirmação ao usuário)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (LOVABLE_API_KEY && RESEND_API_KEY) {
      const scheduled = new Date(inserted.scheduled_for).toLocaleDateString("pt-BR");
      const html = renderHtml({ name: full_name, scheduled, requestId: inserted.id });
      const text = renderText({ name: full_name, scheduled, requestId: inserted.id });
      try {
        await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: `${APP_NAME} <onboarding@resend.dev>`,
            to: [email],
            reply_to: SUPPORT_EMAIL,
            subject: `Recebemos sua solicitação de exclusão de conta — ${APP_NAME}`,
            html,
            text,
            tags: [
              { name: "type", value: "account_deletion_request" },
              { name: "request_id", value: inserted.id },
            ],
          }),
        });
      } catch (e) {
        console.error("email send failed", e);
      }
    }

    return json({
      ok: true,
      request_id: inserted.id,
      scheduled_for: inserted.scheduled_for,
      message: "Solicitação registrada. Você receberá um e-mail de confirmação.",
    });
  } catch (err) {
    console.error("request-account-deletion error", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function renderHtml(p: { name?: string; scheduled: string; requestId: string }) {
  const greeting = p.name ? `Olá, ${esc(p.name)},` : "Olá,";
  return `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
    <h1 style="font-size:20px;margin:0 0 12px">${APP_NAME}</h1>
    <p>${greeting}</p>
    <p>Recebemos sua solicitação para excluir sua conta e seus dados pessoais no <strong>${APP_NAME}</strong>.</p>
    <h2 style="font-size:16px;margin:20px 0 8px">O que acontece agora</h2>
    <ul style="line-height:1.6">
      <li>Sua conta entra em período de carência por 30 dias e a exclusão definitiva está agendada para <strong>${esc(p.scheduled)}</strong>.</li>
      <li>Durante esse período sua conta fica inativa e seus dados públicos (perfil, fotos, serviços) deixam de aparecer.</li>
      <li>Se você quiser cancelar a exclusão, basta entrar em contato com nosso suporte respondendo este e-mail antes da data acima.</li>
    </ul>
    <h2 style="font-size:16px;margin:20px 0 8px">O que será excluído</h2>
    <ul style="line-height:1.6">
      <li>Perfil, nome, foto, telefone, endereço e dados de contato.</li>
      <li>Serviços, fotos do portfólio, avaliações enviadas e mensagens.</li>
      <li>Solicitações de leads, notificações e preferências.</li>
    </ul>
    <h2 style="font-size:16px;margin:20px 0 8px">O que pode ser mantido</h2>
    <ul style="line-height:1.6">
      <li>Registros financeiros e fiscais por até 5 anos por exigência legal.</li>
      <li>Logs anonimizados de segurança e auditoria por até 12 meses.</li>
      <li>Avaliações que você deixou para outros profissionais ficam anonimizadas, sem seu nome.</li>
    </ul>
    <p style="margin-top:24px;font-size:13px;color:#64748b">Protocolo da solicitação: <code>${esc(p.requestId)}</code></p>
    <p style="font-size:13px;color:#64748b">Dúvidas? Responda este e-mail ou escreva para <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:20px">${SITE_URL}</p>
  </div></body></html>`;
}

function renderText(p: { name?: string; scheduled: string; requestId: string }) {
  return [
    `${APP_NAME}`,
    "",
    p.name ? `Olá, ${p.name},` : "Olá,",
    "",
    `Recebemos sua solicitação para excluir sua conta no ${APP_NAME}.`,
    `A exclusão definitiva está agendada para ${p.scheduled} (período de carência de 30 dias).`,
    "",
    "O que será excluído: perfil, fotos, serviços, mensagens, leads e notificações.",
    "O que pode ser mantido: dados financeiros (até 5 anos) e logs de auditoria anonimizados (até 12 meses) por exigência legal.",
    "",
    `Protocolo: ${p.requestId}`,
    `Suporte: ${SUPPORT_EMAIL}`,
    SITE_URL,
  ].join("\n");
}
