/**
 * Validação automática de consistência do sitemap particionado.
 *
 * Roda depois de cada atualização incremental do sitemap index (partições por
 * categoria/cidade) e responde a uma pergunta só: **as URLs listadas no sitemap
 * são realmente indexáveis e canônicas?**
 *
 * Camada 100% pura (sem rede, sem banco) — a página de admin injeta os dados
 * do último relatório `seo_audit_reports` e da listagem do sitemap.
 * Fail-closed: URL sem auditoria vira `unknown`, nunca "ok".
 */
import { normalizeSeoUrl } from './urlCanonicalization';
import { classifyRoute, toPathname, type RouteGroup, type SeoHealthFinding } from './seoHealth';

/** Uma entrada do sitemap, já associada à partição de onde veio. */
export interface SitemapEntry {
  loc: string;
  /** Nome da partição (ex.: `sitemap-categoria.xml`, `sitemap-cidade-1.xml`). */
  partition?: string;
  lastmod?: string;
}

export type ConsistencyKind =
  | 'not_canonical'          // a URL do sitemap não está na forma canônica
  | 'canonical_mismatch'     // canonical da página aponta para outro caminho
  | 'noindex_in_sitemap'     // página com noindex listada no sitemap
  | 'broken_in_sitemap'      // HTTP >= 400 listada no sitemap
  | 'duplicate_entry'        // mesma URL canônica em mais de uma partição
  | 'partition_mismatch'     // rota não bate com a partição declarada
  | 'unaudited';             // sem dado de auditoria → não podemos afirmar nada

export type ConsistencySeverity = 'critical' | 'warning' | 'info';

const SEVERITY: Record<ConsistencyKind, ConsistencySeverity> = {
  not_canonical: 'warning',
  canonical_mismatch: 'critical',
  noindex_in_sitemap: 'critical',
  broken_in_sitemap: 'critical',
  duplicate_entry: 'warning',
  partition_mismatch: 'warning',
  unaudited: 'info',
};

export const CONSISTENCY_LABEL: Record<ConsistencyKind, string> = {
  not_canonical: 'URL não canônica no sitemap',
  canonical_mismatch: 'Canonical aponta para outra URL',
  noindex_in_sitemap: 'Página noindex listada no sitemap',
  broken_in_sitemap: 'URL quebrada listada no sitemap',
  duplicate_entry: 'URL duplicada entre partições',
  partition_mismatch: 'URL fora da partição correta',
  unaudited: 'URL ainda não auditada',
};

export interface ConsistencyIssue {
  kind: ConsistencyKind;
  severity: ConsistencySeverity;
  url: string;
  partition: string;
  route: RouteGroup;
  detail: string;
}

export interface ConsistencyReport {
  checked: number;
  audited: number;
  issues: ConsistencyIssue[];
  byPartition: Array<{ partition: string; total: number; critical: number; warning: number; info: number }>;
  /** true quando não há nenhum problema crítico. */
  passed: boolean;
  /** 0–100. `null` quando não havia nada para checar. */
  score: number | null;
}

/** Partição esperada para uma rota (heurística por nome de arquivo). */
export function expectedPartitionFor(route: RouteGroup): string | null {
  switch (route) {
    case '/categoria':
      return 'categoria';
    case '/cidade':
      return 'cidade';
    case '/bairro':
      return 'bairro';
    case '/profissional':
      return 'profissional';
    default:
      return null;
  }
}

/**
 * Cruza entradas do sitemap com os findings da auditoria e devolve todas as
 * inconsistências de canônico / noindex encontradas.
 */
export function validateSitemapConsistency(
  entries: SitemapEntry[],
  findings: SeoHealthFinding[] | null | undefined,
): ConsistencyReport {
  const byPath = new Map<string, SeoHealthFinding>();
  for (const f of findings ?? []) byPath.set(toPathname(f.url), f);

  const issues: ConsistencyIssue[] = [];
  const seenCanonical = new Map<string, string>();
  let audited = 0;

  for (const entry of entries ?? []) {
    const partition = entry.partition ?? 'sitemap.xml';
    const route = classifyRoute(entry.loc);
    const normalized = normalizeSeoUrl(entry.loc);
    const path = toPathname(entry.loc);
    const push = (kind: ConsistencyKind, detail: string) =>
      issues.push({ kind, severity: SEVERITY[kind], url: entry.loc, partition, route, detail });

    if (normalized.canonicalPath !== path) {
      push('not_canonical', `Forma canônica esperada: ${normalized.canonicalPath}`);
    }

    const previous = seenCanonical.get(normalized.canonicalPath);
    if (previous && previous !== partition) {
      push('duplicate_entry', `Também presente em ${previous}`);
    } else if (!previous) {
      seenCanonical.set(normalized.canonicalPath, partition);
    }

    const expected = expectedPartitionFor(route);
    if (expected && !partition.includes(expected)) {
      push('partition_mismatch', `Rota ${route} deveria estar na partição "${expected}"`);
    }

    const finding = byPath.get(path);
    if (!finding) {
      push('unaudited', 'Sem finding na última auditoria — consistência não confirmada.');
      continue;
    }
    audited += 1;

    if (finding.noindex) {
      push('noindex_in_sitemap', 'Remova do sitemap ou remova o noindex da página.');
    }
    if (finding.status === 'error' || (typeof finding.http_status === 'number' && finding.http_status >= 400)) {
      push('broken_in_sitemap', `HTTP ${finding.http_status ?? 'erro'}`);
    }
    if (finding.canonical && toPathname(finding.canonical) !== path) {
      push('canonical_mismatch', `Canonical da página: ${toPathname(finding.canonical)}`);
    }
  }

  const partitions = new Map<string, { partition: string; total: number; critical: number; warning: number; info: number }>();
  for (const entry of entries ?? []) {
    const p = entry.partition ?? 'sitemap.xml';
    if (!partitions.has(p)) partitions.set(p, { partition: p, total: 0, critical: 0, warning: 0, info: 0 });
    partitions.get(p)!.total += 1;
  }
  for (const i of issues) {
    const bucket = partitions.get(i.partition);
    if (bucket) bucket[i.severity] += 1;
  }

  const checked = (entries ?? []).length;
  const critical = issues.filter((i) => i.severity === 'critical').length;
  const warning = issues.filter((i) => i.severity === 'warning').length;
  const score =
    checked === 0
      ? null
      : Math.max(0, Math.round(100 - (critical / checked) * 100 - (warning / checked) * 40));

  return {
    checked,
    audited,
    issues,
    byPartition: [...partitions.values()].sort((a, b) => b.critical - a.critical || b.total - a.total),
    passed: critical === 0 && checked > 0,
    score,
  };
}

/** CSV das inconsistências, para anexar em ticket/revisão pré-deploy. */
export function consistencyIssuesToCsv(report: ConsistencyReport): string {
  const cell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['severity', 'kind', 'partition', 'route', 'url', 'detail'];
  const rows = report.issues.map((i) =>
    [i.severity, i.kind, i.partition, i.route, i.url, i.detail].map(cell).join(','),
  );
  return [header.join(','), ...rows].join('\n');
}
