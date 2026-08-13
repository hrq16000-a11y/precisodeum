/**
 * Alertas de cobertura do Google Search Console + exportação do histórico de submissões.
 *
 * Tudo aqui é puro (sem I/O) — a UI, a edge function e os testes consomem os mesmos helpers.
 */

import type { CoverageAlert } from "./gscSubmissions";
import { sitemapGroup, type GscAuditRow } from "./gscSubmissions";

export type AlertSeverityThreshold = "critical" | "warning" | "info";

const RANK: Record<AlertSeverityThreshold, number> = { critical: 0, warning: 1, info: 2 };

/** Filtra alertas pelo mínimo de gravidade configurado. */
export function filterBySeverity(
  alerts: CoverageAlert[],
  threshold: AlertSeverityThreshold,
): CoverageAlert[] {
  return alerts.filter((a) => RANK[a.severity] <= RANK[threshold]);
}

/** Assinatura estável do conjunto de alertas — usada para não repetir a mesma notificação. */
export function alertsFingerprint(alerts: CoverageAlert[]): string {
  return alerts
    .map((a) => `${a.sitemap}|${a.metric}|${a.before}->${a.after}`)
    .sort()
    .join(";");
}

export function shouldNotify(
  alerts: CoverageAlert[],
  threshold: AlertSeverityThreshold,
  lastFingerprint?: string | null,
): boolean {
  const relevant = filterBySeverity(alerts, threshold);
  if (relevant.length === 0) return false;
  return alertsFingerprint(relevant) !== (lastFingerprint ?? "");
}

export type AlertContext = {
  property: string | null;
  environment: string;
  /** URL absoluta do painel de diagnóstico (ex.: https://site/admin/seo?tab=submissoes). */
  dashboardUrl: string;
};

const label = (a: CoverageAlert) =>
  `${sitemapGroup(a.sitemap)} — ${a.message}`;

/** Link direto para o diagnóstico da partição afetada. */
export function diagnosticLink(dashboardUrl: string, sitemap: string): string {
  const sep = dashboardUrl.includes("?") ? "&" : "?";
  return `${dashboardUrl}${sep}sitemap=${encodeURIComponent(sitemap)}`;
}

/** Mensagem em texto/Markdown (Slack). */
export function buildSlackMessage(alerts: CoverageAlert[], ctx: AlertContext): string {
  const critical = alerts.filter((a) => a.severity === "critical").length;
  const head =
    `*Cobertura do Search Console piorou* (${ctx.environment}${ctx.property ? ` · ${ctx.property}` : ""})\n` +
    `${alerts.length} alerta(s)${critical ? `, ${critical} crítico(s)` : ""}.`;
  const lines = alerts
    .slice(0, 10)
    .map(
      (a) =>
        `• [${a.severity}] ${label(a)}\n   ${a.suggestion}\n   <${diagnosticLink(ctx.dashboardUrl, a.sitemap)}|Ver diagnóstico>`,
    );
  const more = alerts.length > 10 ? `\n… e mais ${alerts.length - 10} alerta(s).` : "";
  return `${head}\n${lines.join("\n")}${more}`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** E-mail HTML com as principais rotas/categorias e links diretos. */
export function buildEmailHtml(alerts: CoverageAlert[], ctx: AlertContext): string {
  const rows = alerts
    .slice(0, 25)
    .map(
      (a) => `<tr>
  <td style="padding:6px 8px;border-top:1px solid #e2e8f0"><strong>${esc(a.severity)}</strong></td>
  <td style="padding:6px 8px;border-top:1px solid #e2e8f0">${esc(sitemapGroup(a.sitemap))}</td>
  <td style="padding:6px 8px;border-top:1px solid #e2e8f0">${esc(a.message)}<br><span style="color:#64748b;font-size:12px">${esc(a.suggestion)}</span></td>
  <td style="padding:6px 8px;border-top:1px solid #e2e8f0"><a href="${esc(diagnosticLink(ctx.dashboardUrl, a.sitemap))}">Diagnóstico</a></td>
</tr>`,
    )
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
  <h2 style="margin:0 0 8px">Cobertura do Search Console piorou</h2>
  <p style="margin:0 0 12px;color:#475569">Ambiente <strong>${esc(ctx.environment)}</strong>${
    ctx.property ? ` · propriedade <strong>${esc(ctx.property)}</strong>` : ""
  } · ${alerts.length} alerta(s).</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <thead><tr style="text-align:left;color:#64748b;font-size:12px">
      <th style="padding:6px 8px">Gravidade</th><th style="padding:6px 8px">Partição</th>
      <th style="padding:6px 8px">Problema</th><th style="padding:6px 8px">Ação</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin:16px 0 0"><a href="${esc(ctx.dashboardUrl)}">Abrir painel de submissões</a></p>
</div>`;
}

export function buildEmailSubject(alerts: CoverageAlert[], ctx: AlertContext): string {
  const critical = alerts.filter((a) => a.severity === "critical").length;
  return `[SEO${critical ? " · crítico" : ""}] Cobertura GSC piorou em ${ctx.environment} (${alerts.length} alerta${alerts.length === 1 ? "" : "s"})`;
}

/* -------------------------------------------------------------------------- */
/* Exportação do histórico                                                     */
/* -------------------------------------------------------------------------- */

export type SubmissionExportRow = {
  created_at: string;
  property: string;
  sitemap: string;
  partition: string;
  ok: boolean;
  status: number | null;
  attempts: number;
  error: string;
};

type AuditRowWithResponse = GscAuditRow & { response?: unknown };

export function toExportRows(rows: GscAuditRow[]): SubmissionExportRow[] {
  return rows
    .filter((r) => r.action === "submit-sitemap" && !!r.sitemap)
    .map((r) => {
      const resp = (r as AuditRowWithResponse).response as { attempts?: number } | null | undefined;
      return {
        created_at: r.created_at,
        property: r.site ?? "",
        sitemap: r.sitemap as string,
        partition: sitemapGroup(r.sitemap as string),
        ok: r.ok,
        status: r.status,
        attempts: Number(resp?.attempts ?? 1),
        error: r.error ?? "",
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function submissionsToCsv(rows: GscAuditRow[]): string {
  const data = toExportRows(rows);
  const header = [
    "created_at",
    "property",
    "partition",
    "sitemap",
    "ok",
    "status",
    "attempts",
    "error",
  ];
  const lines = data.map((r) =>
    [r.created_at, r.property, r.partition, r.sitemap, r.ok, r.status ?? "", r.attempts, r.error]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function submissionsToJson(rows: GscAuditRow[]): string {
  return JSON.stringify(
    { generated_at: new Date().toISOString(), total: rows.length, rows: toExportRows(rows) },
    null,
    2,
  );
}
