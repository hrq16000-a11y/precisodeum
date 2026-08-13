import { describe, it, expect } from 'vitest';
import {
  normalizeSeoUrl,
  evaluateUrlVariant,
  detectDuplicateVariants,
  auditCanonicalConsistency,
} from '@/lib/seo/urlCanonicalization';
import { BRAND } from '@/config/brand';

const abs = (p: string) => `${BRAND.baseUrl}${p}`;

describe('normalizeSeoUrl · variações de URL', () => {
  it('remove barra final e normaliza caixa', () => {
    const r = normalizeSeoUrl('/Categoria/Eletricista/em/Curitiba/');
    expect(r.canonicalPath).toBe('/categoria/eletricista/em/curitiba');
    expect(r.issues).toContain('uppercase');
    expect(r.issues).toContain('trailing_slash');
    expect(r.redirect.needed).toBe(true);
    expect(r.redirect.status).toBe(301);
  });

  it('colapsa barras duplicadas e remove index.html', () => {
    const r = normalizeSeoUrl('//categoria//eletricista/index.html');
    expect(r.canonicalPath).toBe('/categoria/eletricista');
    expect(r.issues).toContain('duplicate_slash');
    expect(r.issues).toContain('index_file');
  });

  it('descarta parâmetros de rastreamento sem penalizar indexação', () => {
    const r = normalizeSeoUrl('/buscar?categoria=eletricista&utm_source=fb&fbclid=123');
    expect(r.canonicalUrl).toBe(abs('/buscar?categoria=eletricista'));
    expect(r.issues).toContain('tracking_params');
    expect(r.noindexReasons).toHaveLength(0);
  });

  it('facetas e parâmetros desconhecidos forçam noindex e saem do canônico', () => {
    const r = normalizeSeoUrl('/buscar?categoria=eletricista&ordem=preco&xyz=1');
    expect(r.canonicalUrl).toBe(abs('/buscar?categoria=eletricista'));
    expect(r.noindexReasons).toEqual(expect.arrayContaining(['facet_url_variant', 'unknown_query_param']));
  });

  it('ordena parâmetros canônicos e ignora page=1', () => {
    const a = normalizeSeoUrl('/buscar?cidade=curitiba&categoria=eletricista&page=1');
    const b = normalizeSeoUrl('/buscar?categoria=eletricista&cidade=curitiba');
    expect(a.canonicalUrl).toBe(b.canonicalUrl);
    expect(a.issues).toContain('param_order');
  });

  it('normaliza host e esquema divergentes para a marca', () => {
    const r = normalizeSeoUrl('http://precisodeum.LOVABLE.app/Categoria/Pintor');
    expect(r.canonicalUrl).toBe(abs('/categoria/pintor'));
    expect(r.issues).toContain('insecure_scheme');
    expect(r.redirect.to).toBe(abs('/categoria/pintor'));
  });

  it('URL já canônica não pede redirecionamento', () => {
    const r = normalizeSeoUrl(abs('/categoria/eletricista'));
    expect(r.redirect.needed).toBe(false);
    expect(r.issues).toHaveLength(0);
  });

  it('ignora fragmento e parâmetro vazio', () => {
    const r = normalizeSeoUrl('/categoria/pintor?cidade=#depoimentos');
    expect(r.canonicalUrl).toBe(abs('/categoria/pintor'));
    expect(r.issues).toEqual(expect.arrayContaining(['fragment', 'empty_param']));
  });
});

describe('evaluateUrlVariant · guard combinado', () => {
  it('mantém indexável quando a URL é limpa e a página é saudável', () => {
    const v = evaluateUrlVariant({
      type: 'category_city',
      path: '/Categoria/Eletricista/em/Curitiba/',
      slug: 'eletricista',
      categorySlug: 'eletricista',
      citySlug: 'curitiba',
      providersCount: 12,
    });
    expect(v.index).toBe(true);
    expect(v.canonicalUrl).toBe(abs('/categoria/eletricista/em/curitiba'));
  });

  it('faceta derruba indexação mesmo com página saudável', () => {
    const v = evaluateUrlVariant({
      type: 'category_city',
      path: '/categoria/eletricista/em/curitiba?ordem=preco',
      slug: 'eletricista',
      categorySlug: 'eletricista',
      citySlug: 'curitiba',
      providersCount: 12,
    });
    expect(v.index).toBe(false);
    expect(v.robots).toBe('noindex, follow');
    expect(v.reasons).toContain('facet_url_variant');
  });
});

describe('relatórios de duplicidade', () => {
  it('agrupa variações que colapsam no mesmo canônico', () => {
    const groups = detectDuplicateVariants([
      '/categoria/pintor',
      '/Categoria/Pintor/',
      '/categoria/pintor?utm_source=x',
      '/categoria/eletricista',
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].canonicalUrl).toBe(abs('/categoria/pintor'));
    expect(groups[0].variants).toHaveLength(3);
  });

  it('acusa canonical divergente e duplicata indexável', () => {
    const problems = auditCanonicalConsistency([
      { url: '/categoria/pintor', canonical: abs('/categoria/pintor') },
      { url: '/Categoria/Pintor/', canonical: abs('/') },
      { url: '/categoria/pintor?utm_source=x' },
      { url: '/categoria/gesseiro', canonical: abs('/categoria/gesseiro'), noindex: true },
    ]);
    expect(problems.some((p) => p.kind === 'canonical_mismatch')).toBe(true);
    expect(problems.filter((p) => p.kind === 'indexable_duplicate')).toHaveLength(2);
  });
});
