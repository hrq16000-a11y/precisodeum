/**
 * Agregação pura do histórico de submissões de sitemap ao Google Search Console.
 *
 * Fonte: tabela `gsc_audit_log` (action = 'submit-sitemap').
 * Todas as funções aqui são puras — a UI e os testes consomem os mesmos helpers.
 */

export type GscAuditRow = {
  id: number;
  action: string;
  site: string | null;
  sitemap: string | null;
  status: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
};

export type SitemapSubmissionSummary = {
  sitemap: string;
  property: string | null;
  lastAt: string;
  lastOk: boolean;
  lastStatus: number | null;
  lastError: string | null;
  attempts: number;
  failures: number;
  successRate: number; // 0..1
};

export type SubmissionRunSummary = {
  startedAt: string | null;
  finishedAt: string | null;
  property: string | null;
  total: number;
  succeeded: number;
  failed: number;
  ok: boolean;
};

/** Janela (ms) usada para agrupar linhas do log em uma mesma "rodada" de submissão. */
export const RUN_WINDOW_MS = 10 * 60 * 1000;

const SUBMIT_ACTION = "submit-sitemap";

export function isSubmissionRow(row: GscAuditRow): boolean {
  return row.action === SUBMIT_ACTION && !!row.sitemap;
}

/** Estado atual por sitemap (última submissão + histórico agregado). */
export function summarizeBySitemap(rows: GscAuditRow[]): SitemapSubmissionSummary[] {
  const map = new Map<string, SitemapSubmissionSummary>();
  const ordered = [...rows]
    .filter(isSubmissionRow)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const row of ordered) {
    const key = row.sitemap as string;
    const prev = map.get(key);
    const attempts = (prev?.attempts ?? 0) + 1;
    const failures = (prev?.failures ?? 0) + (row.ok ? 0 : 1);
    map.set(key, {
      sitemap: key,
      property: row.site ?? prev?.property ?? null,
      lastAt: row.created_at,
      lastOk: row.ok,
      lastStatus: row.status,
      lastError: row.ok ? null : row.error,
      attempts,
      failures,
      successRate: attempts === 0 ? 0 : (attempts - failures) / attempts,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.lastOk !== b.lastOk) return a.lastOk ? 1 : -1; // falhas primeiro
    return b.lastAt.localeCompare(a.lastAt);
  });
}

/** Agrupa o log em rodadas (builds) usando uma janela temporal. */
export function groupRuns(
  rows: GscAuditRow[],
  windowMs: number = RUN_WINDOW_MS,
): SubmissionRunSummary[] {
  const ordered = [...rows]
    .filter(isSubmissionRow)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const runs: SubmissionRunSummary[] = [];
  let current: { rows: GscAuditRow[] } | null = null;

  const flush = () => {
    if (!current || current.rows.length === 0) return;
    const first = current.rows[0];
    const last = current.rows[current.rows.length - 1];
    const failed = current.rows.filter((r) => !r.ok).length;
    runs.push({
      startedAt: first.created_at,
      finishedAt: last.created_at,
      property: first.site ?? null,
      total: current.rows.length,
      succeeded: current.rows.length - failed,
      failed,
      ok: failed === 0,
    });
    current = null;
  };

  for (const row of ordered) {
    if (!current) {
      current = { rows: [row] };
      continue;
    }
    const last = current.rows[current.rows.length - 1];
    const gap = new Date(row.created_at).getTime() - new Date(last.created_at).getTime();
    if (gap > windowMs) {
      flush();
      current = { rows: [row] };
    } else {
      current.rows.push(row);
    }
  }
  flush();

  return runs.reverse(); // mais recente primeiro
}

/** Cobertura reportada pelo GSC para um sitemap. */
export type GscCoverageSnapshot = {
  sitemap: string;
  submitted: number;
  indexed: number;
  errors: number;
  warnings: number;
};

export type CoverageAlert = {
  sitemap: string;
  severity: "info" | "warning" | "critical";
  metric: "errors" | "warnings" | "indexed" | "submitted";
  before: number;
  after: number;
  delta: number;
  message: string;
  suggestion: string;
};

const SUGGESTIONS: Record<CoverageAlert["metric"], string> = {
  errors:
    "Revise as URLs do sitemap: verifique 404/500, canônicos apontando para outra rota e páginas com noindex.",
  warnings:
    "Cheque URLs bloqueadas por robots.txt ou redirecionadas dentro do sitemap particionado.",
  indexed:
    "Queda de indexação: valide conteúdo fino (thin content), canônicos duplicados e velocidade das rotas afetadas.",
  submitted:
    "Menos URLs enviadas que na build anterior: confirme se a partição não perdeu registros elegíveis.",
};

/**
 * Compara cobertura entre duas builds e emite alertas ordenados por gravidade.
 */
export function diffCoverage(
  before: GscCoverageSnapshot[],
  after: GscCoverageSnapshot[],
): CoverageAlert[] {
  const prev = new Map(before.map((s) => [s.sitemap, s]));
  const alerts: CoverageAlert[] = [];

  for (const cur of after) {
    const old = prev.get(cur.sitemap);
    if (!old) continue;

    const push = (
      metric: CoverageAlert["metric"],
      beforeValue: number,
      afterValue: number,
      worse: boolean,
      severity: CoverageAlert["severity"],
    ) => {
      if (!worse) return;
      const delta = afterValue - beforeValue;
      alerts.push({
        sitemap: cur.sitemap,
        severity,
        metric,
        before: beforeValue,
        after: afterValue,
        delta,
        message:
          metric === "errors" || metric === "warnings"
            ? `${metric === "errors" ? "Erros" : "Avisos"} subiram de ${beforeValue} para ${afterValue}.`
            : `${metric === "indexed" ? "URLs indexadas" : "URLs enviadas"} caíram de ${beforeValue} para ${afterValue}.`,
        suggestion: SUGGESTIONS[metric],
      });
    };

    push("errors", old.errors, cur.errors, cur.errors > old.errors, cur.errors > old.errors * 2 || cur.errors - old.errors >= 10 ? "critical" : "warning");
    push("warnings", old.warnings, cur.warnings, cur.warnings > old.warnings, "info");
    push(
      "indexed",
      old.indexed,
      cur.indexed,
      cur.indexed < old.indexed,
      old.indexed > 0 && cur.indexed < old.indexed * 0.8 ? "critical" : "warning",
    );
    push(
      "submitted",
      old.submitted,
      cur.submitted,
      cur.submitted < old.submitted,
      old.submitted > 0 && cur.submitted < old.submitted * 0.8 ? "warning" : "info",
    );
  }

  const rank: Record<CoverageAlert["severity"], number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || Math.abs(b.delta) - Math.abs(a.delta));
}

/** Extrai o "grupo" (categoria/cidade/tipo) a partir da URL do sub-sitemap. */
export function sitemapGroup(sitemapUrl: string): string {
  try {
    const u = new URL(sitemapUrl);
    const type = u.searchParams.get("type");
    if (type) {
      const page = u.searchParams.get("page");
      return page && page !== "1" ? `${type} (página ${page})` : type;
    }
    return u.pathname.replace(/^\//, "") || "index";
  } catch (_) {
    return sitemapUrl;
  }
}

/** Propriedade GSC configurada por ambiente. */
export type GscEnvironment = "prod" | "staging" | "dev";

export function environmentFromHost(host: string): GscEnvironment {
  const h = host.toLowerCase();
  if (h.includes("localhost") || h.startsWith("127.") || h.includes("lovableproject")) return "dev";
  if (h.includes("staging") || h.includes("preview") || h.includes("id-preview")) return "staging";
  return "prod";
}

export const GSC_PROPERTY_SETTING_KEYS: Record<GscEnvironment, string> = {
  prod: "gsc_property_prod",
  staging: "gsc_property_staging",
  dev: "gsc_property_dev",
};

/** Resolve a propriedade a usar: override explícito → setting do ambiente → única verificada. */
export function resolveEnvProperty(
  env: GscEnvironment,
  settings: Partial<Record<string, string>>,
  verifiedProperties: string[],
  override?: string,
): string | null {
  if (override && verifiedProperties.includes(override)) return override;
  const fromSettings = settings[GSC_PROPERTY_SETTING_KEYS[env]];
  if (fromSettings && verifiedProperties.includes(fromSettings)) return fromSettings;
  if (verifiedProperties.length === 1) return verifiedProperties[0];
  return null;
}
