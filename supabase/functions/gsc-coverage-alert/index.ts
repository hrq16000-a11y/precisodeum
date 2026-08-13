// Envia alertas de piora de cobertura do Google Search Console por e-mail (Resend) e/ou Slack.
//
// Body: {
//   alerts: [{ sitemap, severity, metric, before, after, delta, message, suggestion }],
//   property?, environment?, dashboardUrl?, email?, slack?: boolean, dryRun?: boolean
// }
//
// Auth: admin JWT, service_role ou x-cron-secret (fail-closed).
import { authorizeAdminOrCron } from "../_shared/adminOrCronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Alert = {
  sitemap: string;
  severity: "critical" | "warning" | "info";
  metric: string;
  before: number;
  after: number;
  delta: number;
  message: string;
  suggestion: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function group(sitemap: string): string {
  try {
    const u = new URL(sitemap);
    const type = u.searchParams.get("type");
    if (type) {
      const page = u.searchParams.get("page");
      return page && page !== "1" ? `${type} (página ${page})` : type;
    }
    return u.pathname.replace(/^\//, "") || "index";
  } catch (_) {
    return sitemap;
  }
}

const link = (dash: string, sitemap: string) =>
  `${dash}${dash.includes("?") ? "&" : "?"}sitemap=${encodeURIComponent(sitemap)}`;

function slackText(alerts: Alert[], env: string, property: string, dash: string) {
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const head =
    `*Cobertura do Search Console piorou* (${env}${property ? ` · ${property}` : ""})\n` +
    `${alerts.length} alerta(s)${critical ? `, ${critical} crítico(s)` : ""}.`;
  const lines = alerts.slice(0, 10).map(
    (a) =>
      `• [${a.severity}] ${group(a.sitemap)} — ${a.message}\n   ${a.suggestion}\n   <${
        link(dash, a.sitemap)
      }|Ver diagnóstico>`,
  );
  return `${head}\n${lines.join("\n")}`;
}

function emailHtml(alerts: Alert[], env: string, property: string, dash: string) {
  const rows = alerts
    .slice(0, 25)
    .map(
      (a) =>
        `<tr><td style="padding:6px 8px;border-top:1px solid #e2e8f0"><strong>${esc(a.severity)}</strong></td>` +
        `<td style="padding:6px 8px;border-top:1px solid #e2e8f0">${esc(group(a.sitemap))}</td>` +
        `<td style="padding:6px 8px;border-top:1px solid #e2e8f0">${esc(a.message)}<br><span style="color:#64748b;font-size:12px">${esc(a.suggestion)}</span></td>` +
        `<td style="padding:6px 8px;border-top:1px solid #e2e8f0"><a href="${esc(link(dash, a.sitemap))}">Diagnóstico</a></td></tr>`,
    )
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
  <h2 style="margin:0 0 8px">Cobertura do Search Console piorou</h2>
  <p style="margin:0 0 12px;color:#475569">Ambiente <strong>${esc(env)}</strong>${
    property ? ` · propriedade <strong>${esc(property)}</strong>` : ""
  } · ${alerts.length} alerta(s).</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px"><tbody>${rows}</tbody></table>
  <p style="margin:16px 0 0"><a href="${esc(dash)}">Abrir painel de submissões</a></p>
</div>`;
}

async function writeAudit(entry: Record<string, unknown>) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/gsc_audit_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify([entry]),
    });
  } catch (_) {
    // auditoria nunca quebra o alerta
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authz = await authorizeAdminOrCron(req, corsHeaders);
  if (!authz.ok) return authz.response;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const alerts = Array.isArray(body.alerts) ? (body.alerts as Alert[]).slice(0, 100) : [];
  if (alerts.length === 0) return json({ error: "no_alerts" }, 400);

  const environment = String(body.environment ?? "prod");
  const property = String(body.property ?? "");
  const dashboardUrl = String(
    body.dashboardUrl ?? "https://www.precisodeum.com.br/admin/seo?tab=submissoes",
  );
  const dryRun = body.dryRun === true;
  const email = typeof body.email === "string" && body.email.includes("@") ? body.email : null;
  const wantSlack = body.slack !== false;

  const slackWebhook = Deno.env.get("GSC_ALERT_SLACK_WEBHOOK") ?? Deno.env.get("SLACK_WEBHOOK_URL");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const subject = `[SEO${critical ? " · crítico" : ""}] Cobertura GSC piorou em ${environment} (${alerts.length} alerta${alerts.length === 1 ? "" : "s"})`;

  const channels: Array<Record<string, unknown>> = [];

  if (dryRun) {
    return json({
      dryRun: true,
      alerts: alerts.length,
      subject,
      slack: { configured: !!slackWebhook, enabled: wantSlack, preview: slackText(alerts, environment, property, dashboardUrl) },
      email: { configured: !!resendKey, to: email, preview: emailHtml(alerts, environment, property, dashboardUrl) },
    });
  }

  if (wantSlack && slackWebhook) {
    try {
      const r = await fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: slackText(alerts, environment, property, dashboardUrl) }),
      });
      channels.push({ channel: "slack", ok: r.ok, status: r.status, detail: r.ok ? null : (await r.text()).slice(0, 300) });
    } catch (err) {
      channels.push({ channel: "slack", ok: false, status: 0, detail: String(err).slice(0, 300) });
    }
  } else if (wantSlack) {
    channels.push({ channel: "slack", ok: false, status: 0, detail: "GSC_ALERT_SLACK_WEBHOOK não configurado" });
  }

  if (email) {
    if (!resendKey) {
      channels.push({ channel: "email", ok: false, status: 0, detail: "RESEND_API_KEY não configurado" });
    } else {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: "Preciso de Um <onboarding@resend.dev>",
            to: [email],
            subject,
            html: emailHtml(alerts, environment, property, dashboardUrl),
          }),
        });
        const text = await r.text();
        channels.push({ channel: "email", ok: r.ok, status: r.status, detail: r.ok ? null : text.slice(0, 300) });
      } catch (err) {
        channels.push({ channel: "email", ok: false, status: 0, detail: String(err).slice(0, 300) });
      }
    }
  }

  const ok = channels.some((c) => c.ok === true);
  await writeAudit({
    action: "coverage-alert",
    site: property || null,
    sitemap: null,
    status: ok ? 200 : 500,
    ok,
    response: { environment, alerts: alerts.length, critical, channels },
    error: ok ? null : JSON.stringify(channels).slice(0, 500),
    triggered_by: authz.userId,
  });

  return json({ ok, alerts: alerts.length, critical, subject, channels }, ok ? 200 : 207);
});
