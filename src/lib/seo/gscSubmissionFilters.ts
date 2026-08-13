/**
 * Filtros e paginação do histórico de submissões de sitemap (puro, sem I/O).
 */
import { isSubmissionRow, sitemapGroup, type GscAuditRow } from "./gscSubmissions";

export type SubmissionStatusFilter = "all" | "ok" | "failed";

export type SubmissionFilters = {
  /** Busca livre por URL do sitemap, partição ou mensagem de erro. */
  query: string;
  /** Partição exata (categoria, cidade, index…) ou "all". */
  partition: string;
  status: SubmissionStatusFilter;
  /** ISO date (yyyy-mm-dd) inclusive. */
  from?: string;
  to?: string;
};

export const EMPTY_FILTERS: SubmissionFilters = {
  query: "",
  partition: "all",
  status: "all",
};

/** Nome canônico da partição (sem sufixo de página) — usado no seletor. */
export function partitionKey(sitemapUrl: string): string {
  return sitemapGroup(sitemapUrl).replace(/\s*\(página\s*\d+\)$/i, "");
}

/** Lista de partições distintas presentes no histórico, ordenadas. */
export function availablePartitions(rows: GscAuditRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (isSubmissionRow(r)) set.add(partitionKey(r.sitemap as string));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

const startOfDay = (d: string) => new Date(`${d}T00:00:00.000Z`).getTime();
const endOfDay = (d: string) => new Date(`${d}T23:59:59.999Z`).getTime();

export function filterSubmissions(
  rows: GscAuditRow[],
  filters: SubmissionFilters,
): GscAuditRow[] {
  const q = filters.query.trim().toLowerCase();
  const from = filters.from ? startOfDay(filters.from) : null;
  const to = filters.to ? endOfDay(filters.to) : null;

  return rows.filter((r) => {
    if (!isSubmissionRow(r)) return false;
    if (filters.status === "ok" && !r.ok) return false;
    if (filters.status === "failed" && r.ok) return false;
    if (filters.partition !== "all" && partitionKey(r.sitemap as string) !== filters.partition) {
      return false;
    }
    const t = new Date(r.created_at).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
    if (q) {
      const haystack = [
        r.sitemap ?? "",
        sitemapGroup(r.sitemap as string),
        r.error ?? "",
        String(r.status ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

/** Paginação 1-based tolerante a páginas fora do intervalo. */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pageSize: size,
    totalItems: items.length,
    totalPages,
    hasPrev: current > 1,
    hasNext: current < totalPages,
  };
}
