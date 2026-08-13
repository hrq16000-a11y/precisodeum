/**
 * Drill-down por rota (amostras + diff + CSV) e validação de consistência
 * do sitemap particionado (canônicos / noindex).
 */
import { describe, expect, it } from 'vitest';
import {
  buildRouteDrilldown, diffRouteBetweenReports, routeHistoryToCsv,
  type SeoHealthReport,
} from '@/lib/seo/seoHealth';
import {
  consistencyIssuesToCsv, expectedPartitionFor, validateSitemapConsistency,
} from '@/lib/seo/sitemapConsistency';

const report = (id: string, ran_at: string, findings: SeoHealthReport['findings']): SeoHealthReport => ({
  id,
  ran_at,
  total_urls: findings?.length ?? 0,
  ok_count: (findings ?? []).filter((f) => f.status === 'ok').length,
  warning_count: (findings ?? []).filter((f) => f.status === 'warning').length,
  error_count: (findings ?? []).filter((f) => f.status === 'error').length,
  robots_ok: true,
  sitemap_url: 'https://precisodeum.com.br/sitemap.xml',
  findings,
});

const current = report('b2', '2026-08-12T00:00:00Z', [
  { url: '/categoria/eletricista', status: 'error', http_status: 404, issues: ['http_404'] },
  { url: '/categoria/pintor', status: 'warning', noindex: true, issues: ['noindex'] },
  { url: '/categoria/pedreiro', status: 'ok', issues: [] },
  { url: '/cidade/curitiba', status: 'warning', issues: ['thin_content'] },
]);

const previous = report('b1', '2026-08-11T00:00:00Z', [
  { url: '/categoria/pintor', status: 'warning', noindex: true, issues: ['noindex'] },
  { url: '/categoria/encanador', status: 'error', http_status: 500, issues: ['http_500'] },
  { url: '/cidade/curitiba', status: 'ok', issues: [] },
]);

describe('Drill-down por rota', () => {
  it('mostra amostras reais só de findings com problema', () => {
    const d = buildRouteDrilldown(current, '/categoria');
    expect(d.total).toBe(3);
    expect(d.errors).toBe(1);
    expect(d.noindex).toBe(1);
    expect(d.samples.map((s) => s.url)).toEqual(['/categoria/eletricista', '/categoria/pintor']);
    expect(d.issueCounts[0].count).toBeGreaterThan(0);
  });

  it('respeita o limite de amostras', () => {
    expect(buildRouteDrilldown(current, '/categoria', 1).samples).toHaveLength(1);
  });

  it('calcula diff vs build anterior (novos problemas e resolvidos)', () => {
    const diff = diffRouteBetweenReports(current, previous, '/categoria');
    expect(diff.hasPrevious).toBe(true);
    expect(diff.totalDelta).toBe(1);
    expect(diff.newProblemUrls).toContain('/categoria/eletricista');
    expect(diff.resolvedUrls).toContain('/categoria/encanador');
    expect(diff.newIssues).toContain('http_404');
    expect(diff.resolvedIssues).toContain('http_500');
  });

  it('sem build anterior, não inventa regressão', () => {
    const diff = diffRouteBetweenReports(current, null, '/categoria');
    expect(diff.hasPrevious).toBe(false);
    expect(diff.errorsDelta).toBe(0);
    expect(diff.newProblemUrls).toEqual([]);
  });

  it('exporta CSV do histórico da rota (mais recente primeiro)', () => {
    const csv = routeHistoryToCsv([previous, current], '/categoria');
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('ran_at,route,total,errors');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('2026-08-12');
  });
});

describe('Consistência do sitemap particionado', () => {
  const findings = current.findings!;

  it('acusa noindex e URL quebrada dentro do sitemap', () => {
    const r = validateSitemapConsistency(
      [
        { loc: '/categoria/eletricista', partition: 'sitemap-categoria.xml' },
        { loc: '/categoria/pintor', partition: 'sitemap-categoria.xml' },
      ],
      findings,
    );
    const kinds = r.issues.map((i) => i.kind);
    expect(kinds).toContain('broken_in_sitemap');
    expect(kinds).toContain('noindex_in_sitemap');
    expect(r.passed).toBe(false);
    expect(r.score!).toBeLessThan(100);
  });

  it('detecta canonical divergente', () => {
    const r = validateSitemapConsistency(
      [{ loc: '/categoria/pedreiro', partition: 'sitemap-categoria.xml' }],
      [{ url: '/categoria/pedreiro', status: 'ok', canonical: '/categoria/alvenaria', issues: [] }],
    );
    expect(r.issues.map((i) => i.kind)).toContain('canonical_mismatch');
  });

  it('detecta URL fora da partição correta e duplicata entre partições', () => {
    const r = validateSitemapConsistency(
      [
        { loc: '/cidade/curitiba', partition: 'sitemap-categoria.xml' },
        { loc: '/cidade/curitiba', partition: 'sitemap-cidade-1.xml' },
      ],
      findings,
    );
    const kinds = r.issues.map((i) => i.kind);
    expect(kinds).toContain('partition_mismatch');
    expect(kinds).toContain('duplicate_entry');
  });

  it('URL sem auditoria fica como não confirmada (fail-closed)', () => {
    const r = validateSitemapConsistency(
      [{ loc: '/categoria/vidraceiro', partition: 'sitemap-categoria.xml' }],
      findings,
    );
    expect(r.issues.map((i) => i.kind)).toContain('unaudited');
    expect(r.audited).toBe(0);
  });

  it('sitemap limpo passa na validação', () => {
    const r = validateSitemapConsistency(
      [{ loc: '/categoria/pedreiro', partition: 'sitemap-categoria.xml' }],
      findings,
    );
    expect(r.passed).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'critical')).toHaveLength(0);
  });

  it('sem entradas, não afirma sucesso', () => {
    const r = validateSitemapConsistency([], findings);
    expect(r.passed).toBe(false);
    expect(r.score).toBeNull();
  });

  it('mapeia partição esperada por rota', () => {
    expect(expectedPartitionFor('/categoria')).toBe('categoria');
    expect(expectedPartitionFor('/cidade')).toBe('cidade');
    expect(expectedPartitionFor('/blog')).toBeNull();
  });

  it('exporta CSV das inconsistências', () => {
    const r = validateSitemapConsistency(
      [{ loc: '/categoria/eletricista', partition: 'sitemap-categoria.xml' }],
      findings,
    );
    const csv = consistencyIssuesToCsv(r);
    expect(csv.split('\n')[0]).toBe('severity,kind,partition,route,url,detail');
    expect(csv).toContain('broken_in_sitemap');
  });
});
