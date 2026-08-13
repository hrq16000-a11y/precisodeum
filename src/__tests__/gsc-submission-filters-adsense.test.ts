import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  availablePartitions,
  filterSubmissions,
  paginate,
  partitionKey,
} from "@/lib/seo/gscSubmissionFilters";
import type { GscAuditRow } from "@/lib/seo/gscSubmissions";
import {
  ADSENSE_ISSUE_HINTS,
  summarizeAdsenseFailuresByRoute,
  type AdsenseRouteReport,
} from "@/lib/seo/adsenseCheck";

const row = (over: Partial<GscAuditRow> = {}): GscAuditRow => ({
  id: Math.random(),
  action: "submit-sitemap",
  site: "sc-domain:x.com",
  sitemap: "https://x.com/sitemap.xml?type=categoria&page=2",
  status: 200,
  ok: true,
  error: null,
  created_at: "2026-08-10T10:00:00.000Z",
  ...over,
});

describe("filtros do histórico de submissões", () => {
  const rows = [
    row({ id: 1, created_at: "2026-08-01T10:00:00.000Z" }),
    row({
      id: 2,
      sitemap: "https://x.com/sitemap.xml?type=cidade",
      ok: false,
      status: 429,
      error: "rate limited",
      created_at: "2026-08-05T10:00:00.000Z",
    }),
    row({ id: 3, sitemap: "https://x.com/sitemap.xml", created_at: "2026-08-09T10:00:00.000Z" }),
    row({ id: 4, action: "verify", created_at: "2026-08-09T11:00:00.000Z" }),
  ];

  it("normaliza a partição ignorando o número de página", () => {
    expect(partitionKey("https://x.com/sitemap.xml?type=categoria&page=3")).toBe("categoria");
    expect(partitionKey("https://x.com/sitemap.xml")).toBe("sitemap.xml");
  });

  it("lista partições distintas ignorando linhas que não são submissão", () => {
    expect(availablePartitions(rows)).toEqual(["categoria", "cidade", "sitemap.xml"]);
  });

  it("sem filtros mantém apenas linhas de submissão", () => {
    expect(filterSubmissions(rows, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("filtra por status, partição, busca e período", () => {
    expect(filterSubmissions(rows, { ...EMPTY_FILTERS, status: "failed" })).toHaveLength(1);
    expect(filterSubmissions(rows, { ...EMPTY_FILTERS, status: "ok" })).toHaveLength(2);
    expect(filterSubmissions(rows, { ...EMPTY_FILTERS, partition: "cidade" })).toHaveLength(1);
    expect(filterSubmissions(rows, { ...EMPTY_FILTERS, query: "RATE LIMITED" })).toHaveLength(1);
    expect(filterSubmissions(rows, { ...EMPTY_FILTERS, query: "429" })).toHaveLength(1);
    expect(
      filterSubmissions(rows, { ...EMPTY_FILTERS, from: "2026-08-05", to: "2026-08-09" }),
    ).toHaveLength(2);
  });

  it("combina filtros sem retornar nada quando não há interseção", () => {
    expect(
      filterSubmissions(rows, { ...EMPTY_FILTERS, status: "failed", partition: "categoria" }),
    ).toHaveLength(0);
  });
});

describe("paginação", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("pagina 1-based com metadados corretos", () => {
    const p = paginate(items, 2, 10);
    expect(p.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(p).toMatchObject({ page: 2, totalPages: 3, hasPrev: true, hasNext: true });
  });

  it("clampa páginas fora do intervalo e lista vazia", () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
    const empty = paginate([], 3, 10);
    expect(empty.items).toEqual([]);
    expect(empty).toMatchObject({ page: 1, totalPages: 1, hasNext: false, hasPrev: false });
  });
});

describe("resumo de falhas do AdSense por rota", () => {
  const reports: AdsenseRouteReport[] = [
    {
      route: "/",
      httpStatus: 200,
      ok: true,
      metaClient: "ca-pub-1",
      scriptClient: "ca-pub-1",
      insBlocks: 0,
      issues: [],
    },
    {
      route: "/buscar",
      httpStatus: 200,
      ok: false,
      metaClient: null,
      scriptClient: "ca-pub-1",
      insBlocks: 1,
      issues: [{ code: "meta_missing", level: "error", message: "Meta ausente." }],
    },
    {
      route: "/cidade/curitiba",
      httpStatus: 200,
      ok: true,
      metaClient: "ca-pub-1",
      scriptClient: "ca-pub-1",
      insBlocks: 1,
      issues: [{ code: "script_not_async", level: "warning", message: "Script sem async." }],
    },
  ];

  it("retorna só rotas com problema, erros primeiro, com códigos e dicas", () => {
    const out = summarizeAdsenseFailuresByRoute(reports, "https://precisodeum.com.br/");
    expect(out.map((f) => f.route)).toEqual(["/buscar", "/cidade/curitiba"]);
    expect(out[0].level).toBe("error");
    expect(out[0].errorCodes).toEqual(["meta_missing"]);
    expect(out[0].issues[0].hint).toBe(ADSENSE_ISSUE_HINTS.meta_missing);
    expect(out[1].level).toBe("warning");
    expect(out[1].warningCodes).toEqual(["script_not_async"]);
  });

  it("monta links de rota e diagnóstico sem barra duplicada", () => {
    const [first] = summarizeAdsenseFailuresByRoute(reports, "https://precisodeum.com.br/");
    expect(first.routeUrl).toBe("https://precisodeum.com.br/buscar");
    expect(first.diagnosticUrl).toContain(
      encodeURIComponent("https://precisodeum.com.br/buscar"),
    );
  });

  it("trata rota inacessível (HTTP != 200) como erro mesmo sem issues", () => {
    const out = summarizeAdsenseFailuresByRoute(
      [{ ...reports[0], route: "/vagas", httpStatus: 500, ok: false }],
      "https://x.com",
    );
    expect(out).toHaveLength(1);
    expect(out[0].level).toBe("error");
  });
});
