/**
 * Saúde SEO — camada pura de agregação.
 *
 * Cruza três fontes já existentes no projeto (sem criar tabela nova):
 *   1. `seo_audit_reports` (findings do edge `seo-audit`: canonical, noindex, HTTP);
 *   2. robots.txt / sitemap status do mesmo relatório;
 *   3. cobertura do Google Search Console (`gsc-verify?action=list-sitemaps`),
 *      que expõe `contents[{ type, submitted, indexed }]`.
 *
 * Todas as funções são puras e fail-closed: entrada inválida vira "desconhecido",
 * nunca um número inventado.
 */

export interface SeoHealthFinding {
  url: string;
  status: 'ok' | 'warning' | 'error';
  http_status?: number;
  canonical?: string | null;
  noindex?: boolean;
  issues: string[];
  source_sitemap?: string;
}

export interface SeoHealthReport {
  id: string;
  ran_at: string;
  total_urls: number;
  ok_count: number;
  warning_count: number;
  error_count: number;
  robots_ok: boolean;
  robots_issues?: string[] | null;
  sitemap_url?: string | null;
  findings?: SeoHealthFinding[] | null;
  duration_ms?: number | null;
}

/** Agrupamento de rota usado nos alertas ("por rota", não por URL). */
export type RouteGroup =
  | '/'
  | '/buscar'
  | '/categoria'
  | '/cidade'
  | '/bairro'
  | '/profissional'
  | '/empresa'
  | '/vagas'
  | '/blog'
  | '/institucional'
  | 'outros';

const ROUTE_PATTERNS: Array<[RouteGroup, RegExp]> = [
  ['/categoria', /^\/categoria(\/|$)/],
  ['/cidade', /^\/cidade(s)?(\/|$)/],
  ['/bairro', /^\/bairro(\/|$)/],
  ['/profissional', /^\/profissional(\/|$)/],
  ['/empresa', /^\/empresa(\/|$)/],
  ['/vagas', /^\/vagas?(\/|$)/],
  ['/blog', /^\/blog(\/|$)/],
  ['/buscar', /^\/buscar(\/|$)/],
  ['/institucional', /^\/(sobre|termos|privacidade|cookies|faq|ajuda|como-funciona)(\/|$)/],
];

/** Extrai o pathname de forma tolerante (aceita URL absoluta ou path puro). */
export function toPathname(url: string): string {
  if (!url) return '/';
  try {
    return new URL(url).pathname || '/';
  } catch {
    const clean = url.split('?')[0].split('#')[0];
    return clean.startsWith('/') ? clean : `/${clean}`;
  }
}

export function classifyRoute(url: string): RouteGroup {
  const path = toPathname(url);
  if (path === '/' || path === '') return '/';
  for (const [group, re] of ROUTE_PATTERNS) {
    if (re.test(path)) return group;
  }
  return 'outros';
}

export interface IndexationSummary {
  /** URLs auditadas no relatório. */
  audited: number;
  /** Sem `noindex` e sem erro HTTP → elegíveis para indexação. */
  indexable: number;
  /** Marcadas com `noindex` (intencional ou não). */
  noindex: number;
  /** HTTP >= 400 ou finding de erro. */
  broken: number;
  /** noindex + canonical apontando para outra URL → provável duplicata. */
  canonicalMismatch: number;
  /** Percentual de indexáveis sobre auditadas (0–100, arredondado). */
  indexableRatio: number;
}

const isBroken = (f: SeoHealthFinding): boolean =>
  f.status === 'error' || (typeof f.http_status === 'number' && f.http_status >= 400);

/** Canonical difere da própria URL (comparação por pathname, ignora host/query). */
export function hasCanonicalMismatch(f: SeoHealthFinding): boolean {
  if (!f.canonical) return false;
  return toPathname(f.canonical) !== toPathname(f.url);
}

export function summarizeIndexation(report: SeoHealthReport | null | undefined): IndexationSummary {
  const findings = report?.findings ?? [];
  const audited = findings.length;
  let indexable = 0;
  let noindex = 0;
  let broken = 0;
  let canonicalMismatch = 0;

  for (const f of findings) {
    if (isBroken(f)) broken += 1;
    if (f.noindex) noindex += 1;
    if (hasCanonicalMismatch(f)) canonicalMismatch += 1;
    if (!f.noindex && !isBroken(f)) indexable += 1;
  }

  return {
    audited,
    indexable,
    noindex,
    broken,
    canonicalMismatch,
    indexableRatio: audited === 0 ? 0 : Math.round((indexable / audited) * 100),
  };
}

export interface RouteAlert {
  route: RouteGroup;
  total: number;
  errors: number;
  warnings: number;
  noindex: number;
  /** Problemas mais frequentes do grupo, do mais comum para o menos comum. */
  topIssues: Array<{ issue: string; count: number }>;
  /** Exemplos de URL para investigação rápida (máx. 3). */
  samples: string[];
}

/** Alertas agregados por rota, ordenados por gravidade (erros → avisos → volume). */
export function buildRouteAlerts(
  report: SeoHealthReport | null | undefined,
  maxIssuesPerRoute = 4,
): RouteAlert[] {
  const findings = report?.findings ?? [];
  const map = new Map<RouteGroup, RouteAlert & { issueCounts: Map<string, number> }>();

  for (const f of findings) {
    const route = classifyRoute(f.url);
    let bucket = map.get(route);
    if (!bucket) {
      bucket = {
        route,
        total: 0,
        errors: 0,
        warnings: 0,
        noindex: 0,
        topIssues: [],
        samples: [],
        issueCounts: new Map(),
      };
      map.set(route, bucket);
    }
    bucket.total += 1;
    if (f.status === 'error') bucket.errors += 1;
    if (f.status === 'warning') bucket.warnings += 1;
    if (f.noindex) bucket.noindex += 1;
    for (const issue of f.issues ?? []) {
      bucket.issueCounts.set(issue, (bucket.issueCounts.get(issue) ?? 0) + 1);
    }
    if (f.status !== 'ok' && bucket.samples.length < 3) bucket.samples.push(f.url);
  }

  return [...map.values()]
    .map(({ issueCounts, ...rest }) => ({
      ...rest,
      topIssues: [...issueCounts.entries()]
        .map(([issue, count]) => ({ issue, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, maxIssuesPerRoute),
    }))
    .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || b.total - a.total);
}

export interface HistoryPoint {
  id: string;
  ran_at: string;
  total: number;
  ok: number;
  warnings: number;
  errors: number;
  indexable: number;
  noindex: number;
  robotsOk: boolean;
  /** Variação de erros em relação à execução anterior (negativo = melhorou). */
  errorDelta: number;
}

/** Histórico por build/execução, do mais antigo para o mais recente. */
export function buildHistory(reports: SeoHealthReport[]): HistoryPoint[] {
  const asc = [...(reports ?? [])].sort(
    (a, b) => new Date(a.ran_at).getTime() - new Date(b.ran_at).getTime(),
  );
  let prevErrors: number | null = null;
  return asc.map((r) => {
    const summary = summarizeIndexation(r);
    const point: HistoryPoint = {
      id: r.id,
      ran_at: r.ran_at,
      total: r.total_urls ?? summary.audited,
      ok: r.ok_count ?? 0,
      warnings: r.warning_count ?? 0,
      errors: r.error_count ?? 0,
      indexable: summary.indexable,
      noindex: summary.noindex,
      robotsOk: !!r.robots_ok,
      errorDelta: prevErrors === null ? 0 : (r.error_count ?? 0) - prevErrors,
    };
    prevErrors = r.error_count ?? 0;
    return point;
  });
}

// ─────────────────────────── Google Search Console ───────────────────────────

export interface GscSitemapEntry {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  errors?: string | number;
  warnings?: string | number;
  contents?: Array<{ type?: string; submitted?: string | number; indexed?: string | number }>;
}

export interface GscCoverage {
  /** URLs enviadas ao Google (soma de contents.submitted). */
  submitted: number;
  /** URLs indexadas reportadas pelo Google. */
  indexed: number;
  /** Sitemaps com erro reportado pelo Google. */
  errors: number;
  warnings: number;
  pending: number;
  sitemaps: number;
  /** `null` quando o Google ainda não reportou nenhum número (dado ausente ≠ zero). */
  indexedRatio: number | null;
  lastSubmitted: string | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
};

export function summarizeGscCoverage(entries: GscSitemapEntry[] | null | undefined): GscCoverage {
  const rows = entries ?? [];
  let submitted = 0;
  let indexed = 0;
  let errors = 0;
  let warnings = 0;
  let pending = 0;
  let lastSubmitted: string | null = null;
  let sawContents = false;

  for (const r of rows) {
    errors += num(r.errors);
    warnings += num(r.warnings);
    if (r.isPending) pending += 1;
    if (r.lastSubmitted && (!lastSubmitted || r.lastSubmitted > lastSubmitted)) {
      lastSubmitted = r.lastSubmitted;
    }
    for (const c of r.contents ?? []) {
      sawContents = true;
      submitted += num(c.submitted);
      indexed += num(c.indexed);
    }
  }

  return {
    submitted,
    indexed,
    errors,
    warnings,
    pending,
    sitemaps: rows.length,
    indexedRatio: !sawContents || submitted === 0 ? null : Math.round((indexed / submitted) * 100),
    lastSubmitted,
  };
}

export type CrossSeverity = 'ok' | 'info' | 'warning' | 'critical';

export interface CrossFinding {
  id: string;
  severity: CrossSeverity;
  title: string;
  detail: string;
}

/**
 * Cruza a auditoria local (seo:report / seo-audit) com a cobertura do GSC.
 * Regra fail-closed: sem dado do Google, devolve `info` ("cobertura desconhecida"),
 * nunca um veredito de sucesso.
 */
export function crossReferenceSeo(
  local: IndexationSummary,
  gsc: GscCoverage | null,
  opts: { robotsOk?: boolean; sitemapUrl?: string | null } = {},
): CrossFinding[] {
  const out: CrossFinding[] = [];

  if (opts.robotsOk === false) {
    out.push({
      id: 'robots_failing',
      severity: 'critical',
      title: 'robots.txt com problema',
      detail: 'A auditoria não validou o robots.txt. Crawlers podem estar sendo bloqueados.',
    });
  }

  if (!opts.sitemapUrl) {
    out.push({
      id: 'sitemap_unknown',
      severity: 'warning',
      title: 'Sitemap não confirmado na auditoria',
      detail: 'O relatório local não registrou a URL do sitemap usada na varredura.',
    });
  }

  if (local.broken > 0) {
    out.push({
      id: 'broken_urls',
      severity: 'critical',
      title: `${local.broken} URL(s) quebrada(s) no sitemap`,
      detail: 'URLs com HTTP >= 400 desperdiçam orçamento de rastreamento e derrubam a confiança do domínio.',
    });
  }

  if (local.canonicalMismatch > 0) {
    out.push({
      id: 'canonical_mismatch',
      severity: 'warning',
      title: `${local.canonicalMismatch} canônico(s) divergente(s)`,
      detail: 'A URL do sitemap aponta canonical para outro caminho — remova-a do sitemap ou corrija o canônico.',
    });
  }

  if (local.audited > 0 && local.indexableRatio < 70) {
    out.push({
      id: 'low_indexable_ratio',
      severity: 'warning',
      title: `Só ${local.indexableRatio}% das URLs auditadas são indexáveis`,
      detail: 'O sitemap deve conter apenas URLs indexáveis; noindex e erros precisam sair da lista.',
    });
  }

  if (!gsc) {
    out.push({
      id: 'gsc_unavailable',
      severity: 'info',
      title: 'Cobertura do Search Console indisponível',
      detail: 'Conecte/verifique a propriedade no Search Console para cruzar erros, excluídas e válidas.',
    });
    return out;
  }

  if (gsc.errors > 0) {
    out.push({
      id: 'gsc_errors',
      severity: 'critical',
      title: `Google reporta ${gsc.errors} erro(s) de sitemap`,
      detail: 'O Search Console informa apenas a contagem; abra a aba Search Console para ver o sitemap afetado.',
    });
  }

  if (gsc.warnings > 0) {
    out.push({
      id: 'gsc_warnings',
      severity: 'warning',
      title: `Google reporta ${gsc.warnings} aviso(s) de sitemap`,
      detail: 'Avisos costumam indicar URLs bloqueadas por robots.txt ou fora da propriedade.',
    });
  }

  if (gsc.indexedRatio === null) {
    out.push({
      id: 'gsc_no_coverage',
      severity: 'info',
      title: 'Google ainda não reportou URLs indexadas',
      detail: 'Após enviar o sitemap, a cobertura leva alguns dias para aparecer. Dado ausente não é zero.',
    });
  } else if (gsc.indexedRatio < 50) {
    out.push({
      id: 'gsc_low_indexed',
      severity: 'warning',
      title: `Apenas ${gsc.indexedRatio}% das URLs enviadas estão indexadas`,
      detail: 'Conteúdo raso, duplicidade ou canônicos inconsistentes são as causas mais comuns.',
    });
  }

  if (gsc.submitted > 0 && local.audited > 0) {
    const localIndexable = local.indexable;
    // A auditoria local é uma amostra; só alertamos quando o Google recebeu
    // MENOS URLs do que a amostra local já considera indexável.
    if (gsc.submitted < localIndexable) {
      out.push({
        id: 'submitted_below_local',
        severity: 'warning',
        title: 'Google recebeu menos URLs do que a auditoria local considera indexável',
        detail: `Enviadas ao Google: ${gsc.submitted} · indexáveis na amostra local: ${localIndexable}. Reenvie o sitemap index.`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      id: 'healthy',
      severity: 'ok',
      title: 'Nenhum alerta cruzado',
      detail: 'Auditoria local e cobertura do Search Console estão consistentes.',
    });
  }

  return out;
}

/**
 * Score 0–100 de saúde SEO. Penaliza erros locais, quebras, robots e erros do GSC.
 * Sem auditoria disponível → `null` (desconhecido), nunca 100.
 */
export function computeSeoHealthScore(
  local: IndexationSummary,
  gsc: GscCoverage | null,
  robotsOk: boolean,
): number | null {
  if (local.audited === 0) return null;
  let score = 100;
  score -= Math.min(40, (local.broken / local.audited) * 100);
  score -= Math.min(20, (local.canonicalMismatch / local.audited) * 100 * 0.5);
  score -= Math.max(0, 70 - local.indexableRatio) * 0.4;
  if (!robotsOk) score -= 25;
  if (gsc) {
    if (gsc.errors > 0) score -= 15;
    if (gsc.warnings > 0) score -= 5;
    if (gsc.indexedRatio !== null && gsc.indexedRatio < 50) score -= 10;
  } else {
    score -= 5; // cobertura desconhecida não pode valer nota cheia
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function healthBand(score: number | null): 'unknown' | 'critical' | 'attention' | 'good' | 'excellent' {
  if (score === null) return 'unknown';
  if (score < 50) return 'critical';
  if (score < 70) return 'attention';
  if (score < 90) return 'good';
  return 'excellent';
}
