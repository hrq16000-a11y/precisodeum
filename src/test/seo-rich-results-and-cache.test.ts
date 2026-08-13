import { describe, it, expect } from 'vitest';
import {
  buildRichResultsReport,
  formatRichResultsLog,
  validateRichResultBlock,
  RICH_RESULT_RULES,
} from '@/lib/seo/richResults';
import {
  SeoIncrementalCache,
  buildSeoCacheHeaders,
  computeEtag,
  isNotModified,
  seoCacheKey,
} from '@/lib/seo/seoCache';
import { BRAND, BRAND_BASE_URL } from '@/config/brand';

const org = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND.name,
  url: BRAND_BASE_URL,
  logo: `${BRAND_BASE_URL}/logo.png`,
  sameAs: [`${BRAND_BASE_URL}/sobre`],
};

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Início', item: `${BRAND_BASE_URL}/` },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Eletricista',
      item: `${BRAND_BASE_URL}/categoria/eletricista`,
    },
  ],
};

const faq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Quanto custa um eletricista?',
      acceptedAnswer: { '@type': 'Answer', text: 'Depende do serviço e da cidade.' },
    },
  ],
};

describe('rich results — elegibilidade por tipo', () => {
  it('aprova blocos completos e coerentes com a marca', () => {
    for (const block of [org, breadcrumb, faq]) {
      const report = validateRichResultBlock(block);
      expect(report.eligible, JSON.stringify(report.issues)).toBe(true);
    }
  });

  it('reprova quando falta campo obrigatório do tipo', () => {
    const report = validateRichResultBlock({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
    });
    expect(report.eligible).toBe(false);
    expect(report.issues.some((i) => i.code === 'missing_required_field' && i.field === 'mainEntity')).toBe(true);
  });

  it('reprova ListItem/Question malformados', () => {
    const badCrumb = validateRichResultBlock({
      ...breadcrumb,
      itemListElement: [{ '@type': 'ListItem', position: 1 }],
    });
    expect(badCrumb.eligible).toBe(false);
    expect(badCrumb.issues.some((i) => i.code === 'invalid_item_shape')).toBe(true);

    const badFaq = validateRichResultBlock({
      ...faq,
      mainEntity: [{ '@type': 'Question', name: 'X' }],
    });
    expect(badFaq.eligible).toBe(false);
  });

  it('avisa (sem reprovar) sobre campos recomendados ausentes', () => {
    const report = validateRichResultBlock({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Eletricista João',
    });
    expect(report.eligible).toBe(true);
    expect(report.issues.every((i) => i.severity === 'warning')).toBe(true);
    expect(report.issues.length).toBe(RICH_RESULT_RULES.LocalBusiness.recommended.length);
  });

  it('detecta domínio fora da marca como erro de elegibilidade', () => {
    const report = validateRichResultBlock({
      ...org,
      url: 'https://outro-dominio.com',
    });
    expect(report.eligible).toBe(false);
    expect(report.issues.some((i) => i.code === 'brand_mismatch')).toBe(true);
  });

  it('gera relatório agregado com discrepâncias por página e por tipo', () => {
    const report = buildRichResultsReport([
      { path: '/categoria/eletricista', blocks: [breadcrumb, faq] },
      { path: '/categoria/encanador/em/curitiba', blocks: [breadcrumb, { '@context': 'https://schema.org', '@type': 'FAQPage' }] },
    ]);
    expect(report.ok).toBe(false);
    expect(report.totals.pages).toBe(2);
    expect(report.totals.eligiblePages).toBe(1);
    expect(report.errorsByType.FAQPage).toBeGreaterThanOrEqual(1);

    const log = formatRichResultsLog(report);
    expect(log.some((l) => l.includes('/categoria/encanador/em/curitiba') && l.includes('FAQPage'))).toBe(true);
  });
});

describe('cache SEO com revalidação incremental', () => {
  it('chave inclui canônico, noindex e cidade', () => {
    const a = seoCacheKey({ path: '/categoria/eletricista', canonical: `${BRAND_BASE_URL}/categoria/eletricista`, city: 'curitiba' });
    const b = seoCacheKey({ path: '/categoria/eletricista', canonical: `${BRAND_BASE_URL}/categoria/eletricista`, city: 'pinhais' });
    const c = seoCacheKey({ path: '/categoria/eletricista', canonical: `${BRAND_BASE_URL}/categoria/eletricista`, city: 'curitiba', noindex: true });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(seoCacheKey({ path: '/x', variant: { page: 2, b: 1 } })).toBe(
      seoCacheKey({ path: '/x', variant: { b: 1, page: 2 } }),
    );
  });

  it('serve fresh, depois stale e por fim expira', () => {
    let now = 0;
    const cache = new SeoIncrementalCache<string>({ ttlMs: 100, staleTtlMs: 100, now: () => now });
    cache.set('k', '<xml/>');
    expect(cache.lookup('k').state).toBe('fresh');
    now = 150;
    const stale = cache.lookup('k');
    expect(stale.state).toBe('stale');
    expect(stale.shouldRevalidate).toBe(true);
    expect(stale.entry?.value).toBe('<xml/>');
    now = 500;
    expect(cache.lookup('k').state).toBe('expired');
  });

  it('invalida quando canônico ou noindex divergem (consistência)', () => {
    const cache = new SeoIncrementalCache<string>();
    cache.set('k', 'body', { canonical: `${BRAND_BASE_URL}/a`, noindex: false });
    expect(cache.lookup('k', { canonical: `${BRAND_BASE_URL}/a`, noindex: false }).state).toBe('fresh');
    expect(cache.lookup('k', { canonical: `${BRAND_BASE_URL}/b` }).state).toBe('miss');
  });

  it('invalida por prefixo (ex.: todas as páginas de uma cidade)', () => {
    const cache = new SeoIncrementalCache<string>();
    cache.set('/cidade/curitiba|a', '1');
    cache.set('/cidade/curitiba|b', '2');
    cache.set('/cidade/pinhais|a', '3');
    expect(cache.invalidate('/cidade/curitiba', { prefix: true })).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('ETag é determinístico e habilita 304', () => {
    const etag = computeEtag('<xml>a</xml>');
    expect(etag).toBe(computeEtag('<xml>a</xml>'));
    expect(etag).not.toBe(computeEtag('<xml>b</xml>'));
    expect(isNotModified(`W/${etag}`, etag)).toBe(true);
    expect(isNotModified('"outro"', etag)).toBe(false);
  });

  it('headers usam stale-while-revalidate e nunca cacheiam noindex publicamente', () => {
    const ok = buildSeoCacheHeaders({ ttlSeconds: 3600, etag: '"x"' });
    expect(ok['Cache-Control']).toMatch(/s-maxage=3600/);
    expect(ok['Cache-Control']).toMatch(/stale-while-revalidate=\d+/);
    expect(ok.ETag).toBe('"x"');

    const blocked = buildSeoCacheHeaders({ noindex: true });
    expect(blocked['Cache-Control']).toBe('private, no-store');
    expect(blocked['X-Robots-Tag']).toContain('noindex');
  });
});
