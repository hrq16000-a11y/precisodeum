import { describe, expect, it } from "vitest";
import {
  alertsFingerprint,
  buildEmailHtml,
  buildEmailSubject,
  buildSlackMessage,
  diagnosticLink,
  filterBySeverity,
  shouldNotify,
  submissionsToCsv,
  submissionsToJson,
  toExportRows,
} from "@/lib/seo/gscAlerts";
import type { CoverageAlert, GscAuditRow } from "@/lib/seo/gscSubmissions";

const alert = (over: Partial<CoverageAlert> = {}): CoverageAlert => ({
  sitemap: "https://x.com/sitemap.xml?type=categoria&page=2",
  severity: "critical",
  metric: "errors",
  before: 2,
  after: 30,
  delta: 28,
  message: "Erros subiram de 2 para 30.",
  suggestion: "Revise as URLs.",
  ...over,
});

const ctx = {
  property: "sc-domain:x.com",
  environment: "prod",
  dashboardUrl: "https://x.com/admin/seo?tab=submissoes",
};

const row = (over: Partial<GscAuditRow> = {}): GscAuditRow => ({
  id: 1,
  action: "submit-sitemap",
  site: "sc-domain:x.com",
  sitemap: "https://x.com/sitemap.xml?type=cidade",
  status: 200,
  ok: true,
  error: null,
  created_at: "2026-08-01T10:00:00.000Z",
  ...over,
});

describe("gsc alerts", () => {
  it("filtra por gravidade mínima", () => {
    const list = [alert(), alert({ severity: "warning" }), alert({ severity: "info" })];
    expect(filterBySeverity(list, "critical")).toHaveLength(1);
    expect(filterBySeverity(list, "warning")).toHaveLength(2);
    expect(filterBySeverity(list, "info")).toHaveLength(3);
  });

  it("não renotifica o mesmo conjunto de alertas", () => {
    const list = [alert()];
    const fp = alertsFingerprint(list);
    expect(shouldNotify(list, "warning", null)).toBe(true);
    expect(shouldNotify(list, "warning", fp)).toBe(false);
    expect(shouldNotify([], "info", null)).toBe(false);
  });

  it("gera link direto de diagnóstico por sitemap", () => {
    const url = diagnosticLink(ctx.dashboardUrl, "https://x.com/sitemap.xml?type=categoria");
    expect(url).toContain("&sitemap=");
    expect(url).toContain(encodeURIComponent("type=categoria"));
  });

  it("monta mensagem Slack com rota, sugestão e link", () => {
    const msg = buildSlackMessage([alert()], ctx);
    expect(msg).toContain("categoria (página 2)");
    expect(msg).toContain("Revise as URLs.");
    expect(msg).toContain("Ver diagnóstico");
  });

  it("monta e-mail HTML escapado com assunto crítico", () => {
    const html = buildEmailHtml([alert({ message: '<b>"x"</b> & y' })], ctx);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&amp;");
    expect(buildEmailSubject([alert()], ctx)).toContain("crítico");
    expect(buildEmailSubject([alert({ severity: "warning" })], ctx)).not.toContain("crítico");
  });
});

describe("exportação do histórico", () => {
  it("converte linhas incluindo retries e erros", () => {
    const rows = [
      row({ id: 1, ok: false, status: 429, error: "rate limited", response: { attempts: 3 } } as never),
      row({ id: 2, created_at: "2026-08-02T10:00:00.000Z" }),
      row({ id: 3, action: "verify" }),
    ];
    const out = toExportRows(rows);
    expect(out).toHaveLength(2);
    expect(out[0].created_at).toBe("2026-08-02T10:00:00.000Z"); // mais recente primeiro
    const failed = out.find((r) => !r.ok)!;
    expect(failed.attempts).toBe(3);
    expect(failed.error).toBe("rate limited");
    expect(failed.partition).toBe("cidade");
  });

  it("gera CSV com header e escapa vírgulas/aspas", () => {
    const csv = submissionsToCsv([row({ ok: false, error: 'erro, com "aspas"' })]);
    const [header, line] = csv.split("\n");
    expect(header.split(",")).toContain("attempts");
    expect(line).toContain('"erro, com ""aspas"""');
  });

  it("gera JSON com metadados", () => {
    const parsed = JSON.parse(submissionsToJson([row()]));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.generated_at).toBeTruthy();
  });
});
