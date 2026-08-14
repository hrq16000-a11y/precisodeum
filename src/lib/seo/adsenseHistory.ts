/**
 * Histórico local das verificações do AdSense — base do drill-down por rota.
 *
 * Não cria tabela nova: as execuções ficam em `localStorage` (limitadas a
 * ADSENSE_HISTORY_LIMIT) e são consumidas pelo painel `/admin/seo/submissoes`.
 * As funções de agregação são puras e testáveis.
 */

import {
  ADSENSE_ISSUE_HINTS,
  type AdsenseIssue,
  type AdsenseIssueLevel,
  type AdsenseRouteReport,
} from "./adsenseCheck";

export const ADSENSE_HISTORY_KEY = "adsense_check_history_v1";
export const ADSENSE_HISTORY_LIMIT = 20;

export type AdsenseCheckRun = {
  /** ISO da execução. */
  at: string;
  origin: string;
  reports: AdsenseRouteReport[];
};

export type AdsenseOccurrence = {
  at: string;
  httpStatus: number | null;
  level: AdsenseIssueLevel | "ok";
  code: AdsenseIssue["code"] | null;
  message: string;
  hint: string;
  routeUrl: string;
  diagnosticUrl: string;
};

const routeUrlOf = (origin: string, route: string) =>
  `${origin.replace(/\/+$/, "")}${route.startsWith("/") ? route : `/${route}`}`;

const diagnosticOf = (url: string) =>
  `https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`;

/** Acrescenta uma execução mantendo o histórico ordenado (mais recente primeiro) e limitado. */
export function appendAdsenseRun(
  history: AdsenseCheckRun[],
  run: AdsenseCheckRun,
  limit = ADSENSE_HISTORY_LIMIT,
): AdsenseCheckRun[] {
  return [run, ...history]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, Math.max(1, limit));
}

/** Todas as ocorrências registradas para uma rota (mais recente primeiro). */
export function routeOccurrences(
  history: AdsenseCheckRun[],
  route: string,
): AdsenseOccurrence[] {
  const out: AdsenseOccurrence[] = [];
  for (const run of [...history].sort((a, b) => b.at.localeCompare(a.at))) {
    const report = run.reports.find((r) => r.route === route);
    if (!report) continue;
    const url = routeUrlOf(run.origin, route);
    if (report.issues.length === 0) {
      out.push({
        at: run.at,
        httpStatus: report.httpStatus,
        level: report.httpStatus === 200 ? "ok" : "error",
        code: null,
        message:
          report.httpStatus === 200
            ? "Sem problemas detectados nesta execução."
            : `Rota respondeu HTTP ${report.httpStatus ?? "—"}.`,
        hint: "",
        routeUrl: url,
        diagnosticUrl: diagnosticOf(url),
      });
      continue;
    }
    for (const issue of report.issues) {
      out.push({
        at: run.at,
        httpStatus: report.httpStatus,
        level: issue.level,
        code: issue.code,
        message: issue.message,
        hint: ADSENSE_ISSUE_HINTS[issue.code] ?? "",
        routeUrl: url,
        diagnosticUrl: diagnosticOf(url),
      });
    }
  }
  return out;
}

/** Nº de execuções consecutivas (a partir da mais recente) em que a rota falhou. */
export function routeFailureStreak(history: AdsenseCheckRun[], route: string): number {
  let streak = 0;
  for (const run of [...history].sort((a, b) => b.at.localeCompare(a.at))) {
    const report = run.reports.find((r) => r.route === route);
    if (!report) break;
    const failed = report.httpStatus !== 200 || report.issues.some((i) => i.level === "error");
    if (!failed) break;
    streak += 1;
  }
  return streak;
}

/** Rotas presentes em qualquer execução do histórico. */
export function historyRoutes(history: AdsenseCheckRun[]): string[] {
  const set = new Set<string>();
  history.forEach((run) => run.reports.forEach((r) => set.add(r.route)));
  return Array.from(set).sort();
}

/* ── Persistência (tolerante a ambiente sem window/localStorage) ── */

export function loadAdsenseHistory(): AdsenseCheckRun[] {
  try {
    const raw = globalThis.localStorage?.getItem(ADSENSE_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AdsenseCheckRun[]) : [];
  } catch {
    return [];
  }
}

export function saveAdsenseHistory(history: AdsenseCheckRun[]): void {
  try {
    globalThis.localStorage?.setItem(ADSENSE_HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* quota/privado: histórico é best-effort */
  }
}
