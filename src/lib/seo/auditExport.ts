/**
 * Relatório consolidado da última auditoria de SEO.
 *
 * Junta em um único arquivo (JSON ou CSV):
 *   1. verificações do AdSense por rota;
 *   2. canônicos / noindex e disponibilidade HTTP (`seo_audit_reports`);
 *   3. resultados de submissão e cobertura no Google Search Console.
 *
 * Camada pura — a UI só monta o input e dispara o download.
 */

import type { AdsenseRouteReport } from "./adsenseCheck";
import type { GscCoverageSnapshot, SitemapSubmissionSummary } from "./gscSubmissions";
import type { GscMetrics } from "./gscMetrics";
import type { SeoHealthReport } from "./seoHealth";

export type ConsolidatedAuditInput = {
  generatedAt?: string;
  origin: string;
  environment: string;
  property: string | null;
  seoReport?: SeoHealthReport | null;
  adsense?: AdsenseRouteReport[] | null;
  submissions?: SitemapSubmissionSummary[] | null;
  coverage?: GscCoverageSnapshot[] | null;
  metrics?: GscMetrics | null;
};

export type ConsolidatedAudit = {
  generatedAt: string;
  origin: string;
  environment: string;
  property: string | null;
  summary: {
    urlsAudited: number;
    indexable: number;
    noindex: number;
    broken: number;
    canonicalMismatch: number;
    adsenseRoutes: number;
    adsenseErrors: number;
    adsenseWarnings: number;
    sitemapsSubmitted: number;
    sitemapFailures: number;
    gscFailureRate: number | null;
  };
  pages: Array<{
    url: string;
    httpStatus: number | null;
    canonical: string | null;
    noindex: boolean;
    status: string;
    issues: string;
  }>;
  adsense: Array<{
    route: string;
    httpStatus: number | null;
    errors: string;
    warnings: string;
  }>;
  gscSubmissions: Array<{
    sitemap: string;
    lastAt: string;
    lastOk: boolean;
    lastStatus: number | null;
    attempts: number;
    failures: number;
    lastError: string | null;
  }>;
  gscCoverage: Array<{
    sitemap: string;
    submitted: number;
    indexed: number;
    errors: number;
    warnings: number;
  }>;
};

export function buildConsolidatedAudit(input: ConsolidatedAuditInput): ConsolidatedAudit {
  const findings = input.seoReport?.findings ?? [];
  const adsense = input.adsense ?? [];
  const submissions = input.submissions ?? [];
  const coverage = input.coverage ?? [];

  const isBroken = (f: (typeof findings)[number]) =>
    f.status === "error" || (typeof f.http_status === "number" && f.http_status >= 400);
  const pathOf = (u: string) => {
    try {
      return new URL(u).pathname;
    } catch {
      return u;
    }
  };

  const adsenseErrors = adsense.reduce(
    (acc, r) => acc + r.issues.filter((i) => i.level === "error").length,
    0,
  );
  const adsenseWarnings = adsense.reduce(
    (acc, r) => acc + r.issues.filter((i) => i.level === "warning").length,
    0,
  );

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    origin: input.origin,
    environment: input.environment,
    property: input.property ?? null,
    summary: {
      urlsAudited: findings.length,
      indexable: findings.filter((f) => !f.noindex && !isBroken(f)).length,
      noindex: findings.filter((f) => !!f.noindex).length,
      broken: findings.filter(isBroken).length,
      canonicalMismatch: findings.filter(
        (f) => !!f.canonical && pathOf(f.canonical) !== pathOf(f.url),
      ).length,
      adsenseRoutes: adsense.length,
      adsenseErrors,
      adsenseWarnings,
      sitemapsSubmitted: submissions.length,
      sitemapFailures: submissions.filter((s) => !s.lastOk).length,
      gscFailureRate: input.metrics ? input.metrics.failureRate : null,
    },
    pages: findings.map((f) => ({
      url: f.url,
      httpStatus: f.http_status ?? null,
      canonical: f.canonical ?? null,
      noindex: !!f.noindex,
      status: f.status,
      issues: (f.issues ?? []).join("; "),
    })),
    adsense: adsense.map((r) => ({
      route: r.route,
      httpStatus: r.httpStatus,
      errors: r.issues.filter((i) => i.level === "error").map((i) => i.code).join("; "),
      warnings: r.issues.filter((i) => i.level === "warning").map((i) => i.code).join("; "),
    })),
    gscSubmissions: submissions.map((s) => ({
      sitemap: s.sitemap,
      lastAt: s.lastAt,
      lastOk: s.lastOk,
      lastStatus: s.lastStatus,
      attempts: s.attempts,
      failures: s.failures,
      lastError: s.lastError,
    })),
    gscCoverage: coverage.map((c) => ({
      sitemap: c.sitemap,
      submitted: c.submitted,
      indexed: c.indexed,
      errors: c.errors,
      warnings: c.warnings,
    })),
  };
}

export function consolidatedAuditToJson(audit: ConsolidatedAudit): string {
  return JSON.stringify(audit, null, 2);
}

const esc = (value: unknown): string => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV único com todas as seções (coluna `secao` identifica a origem da linha).
 * Formato longo → abre direto no Excel/Sheets sem quebrar colunas.
 */
export function consolidatedAuditToCsv(audit: ConsolidatedAudit): string {
  const header = ["secao", "chave", "campo1", "campo2", "campo3", "campo4", "campo5"];
  const lines: string[][] = [header];

  lines.push(["meta", "gerado_em", audit.generatedAt, audit.origin, audit.environment, audit.property ?? "", ""]);
  Object.entries(audit.summary).forEach(([k, v]) => {
    lines.push(["resumo", k, String(v ?? ""), "", "", "", ""]);
  });
  audit.pages.forEach((p) => {
    lines.push([
      "pagina",
      p.url,
      String(p.httpStatus ?? ""),
      p.canonical ?? "",
      p.noindex ? "noindex" : "index",
      p.status,
      p.issues,
    ]);
  });
  audit.adsense.forEach((a) => {
    lines.push(["adsense", a.route, String(a.httpStatus ?? ""), a.errors, a.warnings, "", ""]);
  });
  audit.gscSubmissions.forEach((s) => {
    lines.push([
      "gsc_submissao",
      s.sitemap,
      s.lastAt,
      s.lastOk ? "ok" : "falha",
      String(s.lastStatus ?? ""),
      `${s.failures}/${s.attempts}`,
      s.lastError ?? "",
    ]);
  });
  audit.gscCoverage.forEach((c) => {
    lines.push([
      "gsc_cobertura",
      c.sitemap,
      String(c.submitted),
      String(c.indexed),
      String(c.errors),
      String(c.warnings),
      "",
    ]);
  });

  return lines.map((row) => row.map(esc).join(",")).join("\n");
}
