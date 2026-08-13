import { describe, expect, it } from 'vitest';
import {
  buildHistory, buildRouteAlerts, classifyRoute, computeSeoHealthScore,
  crossReferenceSeo, hasCanonicalMismatch, healthBand, summarizeGscCoverage,
  summarizeIndexation, toPathname,
  type SeoHealthReport,
} from '@/lib/seo/seoHealth';

const report = (over: Partial<SeoHealthReport> = {}): SeoHealthReport => ({
  id: 'r1',
  ran_at: '2026-08-01T10:00:00Z',
  total_urls: 4,
  ok_count: 2,
  warning_count: 1,
  error_count: 1,
  robots_ok: true,
  sitemap_url: 'https://www.precisodeum.com.br/sitemap.xml',
  findings: [
    { url: 'https://www.precisodeum.com.br/categoria/eletricista', status: 'ok', http_status: 200, canonical: 'https://www.precisodeum.com.br/categoria/eletricista', noindex: false, issues: [] },
    { url: 'https://www.precisodeum.com.br/cidade/curitiba', status: 'warning', http_status: 200, canonical: 'https://www.precisodeum.com.br/cidade/curitiba', noindex: true, issues: ['noindex em URL do sitemap'] },
    { url: 'https://www.precisodeum.com.br/profissional/joao', status: 'error', http_status: 404, canonical: null, noindex: false, issues: ['HTTP 404'] },
    { url: 'https://www.precisodeum.com.br/buscar?ordem=recentes', status: 'warning', http_status: 200, canonical: 'https://www.precisodeum.com.br/buscar', noindex: false, issues: ['canonical divergente'] },
  ],
  duration_ms: 1200,
  ...over,
});

describe('seoHealth · classificação de rota', () => {
  it('normaliza pathname de URL absoluta e relativa', () => {
    expect(toPathname('https://x.com/cidade/curitiba?a=1')).toBe('/cidade/curitiba');
    expect(toPathname('categoria/eletricista')).toBe('/categoria/eletricista');
  });

  it('agrupa por família de rota', () => {
    expect(classifyRoute('https://x.com/')).toBe('/');
    expect(classifyRoute('/categoria/pintor')).toBe('/categoria');
    expect(classifyRoute('/cidades')).toBe('/cidade');
    expect(classifyRoute('/profissional/ana')).toBe('/profissional');
    expect(classifyRoute('/termos')).toBe('/institucional');
    expect(classifyRoute('/qualquer-coisa')).toBe('outros');
  });
});

describe('seoHealth · indexação', () => {
  it('conta indexáveis, noindex, quebradas e canônicos divergentes', () => {
    const s = summarizeIndexation(report());
    expect(s.audited).toBe(4);
    expect(s.noindex).toBe(1);
    expect(s.broken).toBe(1);
    expect(s.canonicalMismatch).toBe(1);
    expect(s.indexable).toBe(2);
    expect(s.indexableRatio).toBe(50);
  });

  it('sem relatório devolve zeros e nunca quebra', () => {
    const s = summarizeIndexation(null);
    expect(s.audited).toBe(0);
    expect(s.indexableRatio).toBe(0);
  });

  it('canonical igual (host diferente) não é divergência', () => {
    expect(hasCanonicalMismatch({ url: 'https://a.com/x', canonical: 'https://www.a.com/x', status: 'ok', issues: [] })).toBe(false);
  });
});

describe('seoHealth · alertas por rota', () => {
  it('ordena por erros e lista problemas mais comuns', () => {
    const alerts = buildRouteAlerts(report());
    expect(alerts[0].route).toBe('/profissional');
    expect(alerts[0].errors).toBe(1);
    const cidade = alerts.find((a) => a.route === '/cidade')!;
    expect(cidade.noindex).toBe(1);
    expect(cidade.topIssues[0]).toEqual({ issue: 'noindex em URL do sitemap', count: 1 });
    expect(cidade.samples).toContain('https://www.precisodeum.com.br/cidade/curitiba');
  });
});

describe('seoHealth · histórico', () => {
  it('calcula delta de erros entre execuções', () => {
    const h = buildHistory([
      report({ id: 'a', ran_at: '2026-08-01T10:00:00Z', error_count: 5 }),
      report({ id: 'b', ran_at: '2026-08-02T10:00:00Z', error_count: 2 }),
    ]);
    expect(h.map((p) => p.id)).toEqual(['a', 'b']);
    expect(h[0].errorDelta).toBe(0);
    expect(h[1].errorDelta).toBe(-3);
  });
});

describe('seoHealth · cobertura GSC', () => {
  it('soma submitted/indexed e calcula razão', () => {
    const c = summarizeGscCoverage([
      { path: 's1', errors: '2', warnings: 0, lastSubmitted: '2026-08-01', contents: [{ submitted: '100', indexed: '60' }] },
      { path: 's2', isPending: true, contents: [{ submitted: 100, indexed: 40 }] },
    ]);
    expect(c.submitted).toBe(200);
    expect(c.indexed).toBe(100);
    expect(c.indexedRatio).toBe(50);
    expect(c.errors).toBe(2);
    expect(c.pending).toBe(1);
  });

  it('sem contents devolve razão nula (ausente ≠ zero)', () => {
    expect(summarizeGscCoverage([{ path: 's1' }]).indexedRatio).toBeNull();
    expect(summarizeGscCoverage(null).sitemaps).toBe(0);
  });
});

describe('seoHealth · cruzamento e score', () => {
  it('sinaliza GSC indisponível como info, sem veredito de sucesso', () => {
    const f = crossReferenceSeo(summarizeIndexation(report()), null, { robotsOk: true, sitemapUrl: '/sitemap.xml' });
    expect(f.some((x) => x.id === 'gsc_unavailable' && x.severity === 'info')).toBe(true);
    expect(f.some((x) => x.id === 'healthy')).toBe(false);
  });

  it('detecta robots quebrado, URLs quebradas e ratio baixo', () => {
    const f = crossReferenceSeo(summarizeIndexation(report()), null, { robotsOk: false, sitemapUrl: null });
    const ids = f.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['robots_failing', 'sitemap_unknown', 'broken_urls', 'canonical_mismatch', 'low_indexable_ratio']));
  });

  it('cenário limpo com GSC saudável devolve ok', () => {
    const clean = summarizeIndexation(report({
      findings: [{ url: 'https://x.com/a', status: 'ok', http_status: 200, canonical: 'https://x.com/a', noindex: false, issues: [] }],
    }));
    const f = crossReferenceSeo(clean, summarizeGscCoverage([
      { path: 's', contents: [{ submitted: 10, indexed: 9 }] },
    ]), { robotsOk: true, sitemapUrl: '/sitemap.xml' });
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('ok');
  });

  it('score é nulo sem auditoria e nunca 100 sem cobertura do Google', () => {
    expect(computeSeoHealthScore(summarizeIndexation(null), null, true)).toBeNull();
    const clean = summarizeIndexation(report({
      findings: [{ url: 'https://x.com/a', status: 'ok', http_status: 200, canonical: 'https://x.com/a', noindex: false, issues: [] }],
    }));
    const score = computeSeoHealthScore(clean, null, true)!;
    expect(score).toBeLessThan(100);
    expect(healthBand(score)).toBe('excellent');
    expect(healthBand(null)).toBe('unknown');
  });

  it('penaliza robots quebrado e erros do GSC', () => {
    const s = summarizeIndexation(report());
    const withGsc = computeSeoHealthScore(s, summarizeGscCoverage([{ path: 's', errors: 3, contents: [{ submitted: 10, indexed: 1 }] }]), false)!;
    expect(withGsc).toBeLessThan(50);
    expect(healthBand(withGsc)).toBe('critical');
  });
});
