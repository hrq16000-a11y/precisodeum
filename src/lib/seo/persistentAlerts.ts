/**
 * Alertas persistentes (GSC + AdSense).
 *
 * Regra: só alerta quando a MESMA falha se repete por N execuções consecutivas.
 * As regras ficam em `site_settings` (chave `seo_persistent_alert_rules`), então
 * são editáveis pelo admin sem deploy. Camada pura — envio fica na UI/edge.
 */

import type { AdsenseCheckRun } from "./adsenseHistory";
import type { GscAuditRow } from "./gscSubmissions";
import { isSubmissionRow, sitemapGroup } from "./gscSubmissions";

export const PERSISTENT_RULES_SETTING_KEY = "seo_persistent_alert_rules";

export type PersistentAlertTarget = "gsc" | "adsense";
export type PersistentAlertSeverity = "critical" | "warning" | "info";

export type PersistentAlertRule = {
  target: PersistentAlertTarget;
  /** Nº de execuções consecutivas com falha para disparar. */
  consecutive: number;
  severity: PersistentAlertSeverity;
  slack: boolean;
  email: boolean;
  enabled: boolean;
};

export const DEFAULT_PERSISTENT_RULES: PersistentAlertRule[] = [
  { target: "gsc", consecutive: 3, severity: "critical", slack: true, email: true, enabled: true },
  { target: "adsense", consecutive: 2, severity: "warning", slack: true, email: false, enabled: true },
];

const SEVERITIES: PersistentAlertSeverity[] = ["critical", "warning", "info"];

const sanitizeRule = (raw: unknown, fallback: PersistentAlertRule): PersistentAlertRule => {
  const r = (raw ?? {}) as Partial<PersistentAlertRule>;
  const consecutive = Number(r.consecutive);
  return {
    target: r.target === "adsense" ? "adsense" : r.target === "gsc" ? "gsc" : fallback.target,
    consecutive: Number.isFinite(consecutive) ? Math.min(20, Math.max(1, Math.round(consecutive))) : fallback.consecutive,
    severity: SEVERITIES.includes(r.severity as PersistentAlertSeverity)
      ? (r.severity as PersistentAlertSeverity)
      : fallback.severity,
    slack: typeof r.slack === "boolean" ? r.slack : fallback.slack,
    email: typeof r.email === "boolean" ? r.email : fallback.email,
    enabled: typeof r.enabled === "boolean" ? r.enabled : fallback.enabled,
  };
};

/** Lê as regras de forma fail-safe — entrada inválida volta ao padrão. */
export function parseRules(raw: string | null | undefined): PersistentAlertRule[] {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const list = Array.isArray(parsed) ? parsed : [];
  return DEFAULT_PERSISTENT_RULES.map((fallback) => {
    const match = list.find((r) => (r as PersistentAlertRule)?.target === fallback.target);
    return sanitizeRule(match, fallback);
  });
}

export function serializeRules(rules: PersistentAlertRule[]): string {
  return JSON.stringify(parseRules(JSON.stringify(rules)));
}

export type ConsecutiveFailure = {
  /** Identificador estável (sitemap ou rota). */
  key: string;
  label: string;
  streak: number;
  firstFailureAt: string;
  lastFailureAt: string;
  lastError: string | null;
};

/** Sequência atual de falhas por sitemap (a partir da submissão mais recente). */
export function gscConsecutiveFailures(rows: GscAuditRow[]): ConsecutiveFailure[] {
  const byKey = new Map<string, GscAuditRow[]>();
  for (const row of rows.filter(isSubmissionRow)) {
    const key = row.sitemap as string;
    const list = byKey.get(key);
    if (list) list.push(row);
    else byKey.set(key, [row]);
  }

  const out: ConsecutiveFailure[] = [];
  byKey.forEach((list, key) => {
    const desc = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const streakRows: GscAuditRow[] = [];
    for (const row of desc) {
      if (row.ok) break;
      streakRows.push(row);
    }
    if (streakRows.length === 0) return;
    out.push({
      key,
      label: sitemapGroup(key),
      streak: streakRows.length,
      firstFailureAt: streakRows[streakRows.length - 1].created_at,
      lastFailureAt: streakRows[0].created_at,
      lastError: streakRows[0].error ?? (streakRows[0].status ? `HTTP ${streakRows[0].status}` : null),
    });
  });

  return out.sort((a, b) => b.streak - a.streak || a.key.localeCompare(b.key));
}

/** Sequência atual de falhas por rota no histórico de verificações do AdSense. */
export function adsenseConsecutiveFailures(history: AdsenseCheckRun[]): ConsecutiveFailure[] {
  const desc = [...history].sort((a, b) => b.at.localeCompare(a.at));
  const routes = new Set<string>();
  desc.forEach((run) => run.reports.forEach((r) => routes.add(r.route)));

  const out: ConsecutiveFailure[] = [];
  routes.forEach((route) => {
    const streakRuns: AdsenseCheckRun[] = [];
    for (const run of desc) {
      const report = run.reports.find((r) => r.route === route);
      if (!report) break;
      const failed = report.httpStatus !== 200 || report.issues.some((i) => i.level === "error");
      if (!failed) break;
      streakRuns.push(run);
    }
    if (streakRuns.length === 0) return;
    const lastReport = streakRuns[0].reports.find((r) => r.route === route);
    out.push({
      key: route,
      label: route,
      streak: streakRuns.length,
      firstFailureAt: streakRuns[streakRuns.length - 1].at,
      lastFailureAt: streakRuns[0].at,
      lastError:
        lastReport && lastReport.httpStatus !== 200
          ? `HTTP ${lastReport.httpStatus ?? "—"}`
          : (lastReport?.issues.find((i) => i.level === "error")?.code ?? null),
    });
  });

  return out.sort((a, b) => b.streak - a.streak || a.key.localeCompare(b.key));
}

export type PersistentAlert = ConsecutiveFailure & {
  target: PersistentAlertTarget;
  severity: PersistentAlertSeverity;
  slack: boolean;
  email: boolean;
  threshold: number;
};

/** Cruza falhas consecutivas × regras; devolve só o que atingiu o limiar. */
export function evaluatePersistentAlerts(
  failures: ConsecutiveFailure[],
  rules: PersistentAlertRule[],
  target: PersistentAlertTarget,
): PersistentAlert[] {
  const rule = rules.find((r) => r.target === target);
  if (!rule || !rule.enabled) return [];
  return failures
    .filter((f) => f.streak >= rule.consecutive)
    .map((f) => ({
      ...f,
      target,
      severity: rule.severity,
      slack: rule.slack,
      email: rule.email,
      threshold: rule.consecutive,
    }));
}

/** Impressão digital estável — evita reenviar o mesmo alerta. */
export function persistentAlertsFingerprint(alerts: PersistentAlert[]): string {
  return alerts
    .map((a) => `${a.target}:${a.key}:${a.streak}:${a.severity}`)
    .sort()
    .join("|");
}

export function buildPersistentAlertMessage(
  alerts: PersistentAlert[],
  ctx: { property: string; dashboardUrl: string },
): string {
  if (alerts.length === 0) return "";
  const lines = alerts.map(
    (a) =>
      `• [${a.severity.toUpperCase()}] ${a.target === "gsc" ? "Sitemap" : "Rota"} ${a.label} — ${a.streak} execuções seguidas com falha (limiar ${a.threshold})${a.lastError ? ` · ${a.lastError}` : ""}`,
  );
  return [
    `*Falha persistente de SEO* — ${ctx.property}`,
    ...lines,
    `Painel: ${ctx.dashboardUrl}`,
  ].join("\n");
}
