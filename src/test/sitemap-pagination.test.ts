/**
 * Testa os helpers puros de construção de sitemap (paginação, escape XML, URL).
 * Garante paridade de formato com supabase/functions/sitemap/index.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  SITEMAP_PAGE_SIZE,
  escapeXml,
  sitemapEntry,
  paginate,
  pageCount,
  subSitemapUrl,
  isValidSitemapXml,
} from '@/lib/sitemapBuilder';

describe('sitemapBuilder — paginação', () => {
  it('SITEMAP_PAGE_SIZE = 5000 (alinhado com edge function)', () => {
    expect(SITEMAP_PAGE_SIZE).toBe(5000);
  });

  it('paginate divide listas em chunks do tamanho configurado', () => {
    const items = Array.from({ length: 12345 }, (_, i) => i);
    const pages = paginate(items);
    expect(pages.length).toBe(3);
    expect(pages[0].length).toBe(5000);
    expect(pages[1].length).toBe(5000);
    expect(pages[2].length).toBe(2345);
  });

  it('paginate retorna [] quando não há itens', () => {
    expect(paginate([])).toEqual([]);
  });

  it('pageCount sempre >= 1 (índice nunca fica vazio)', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(5000)).toBe(1);
    expect(pageCount(5001)).toBe(2);
    expect(pageCount(15000)).toBe(3);
  });

  it('subSitemapUrl omite &page=1 e anexa páginas seguintes', () => {
    const base = 'https://precisodeum.com.br/sitemap';
    expect(subSitemapUrl(base, 'providers', 1)).toBe(`${base}?type=providers`);
    expect(subSitemapUrl(base, 'providers', 2)).toBe(`${base}?type=providers&page=2`);
    expect(subSitemapUrl(base, 'cities', 7)).toBe(`${base}?type=cities&page=7`);
  });
});

describe('sitemapBuilder — XML válido', () => {
  it('escapeXml escapa caracteres reservados', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });

  it('sitemapEntry produz <url> com loc/lastmod/changefreq/priority', () => {
    const xml = sitemapEntry(
      'https://precisodeum.com.br',
      '/categoria/eletricista',
      '2026-04-29',
      'daily',
      '0.9',
    );
    expect(xml).toContain('<loc>https://precisodeum.com.br/categoria/eletricista</loc>');
    expect(xml).toContain('<lastmod>2026-04-29</lastmod>');
    expect(xml).toContain('<changefreq>daily</changefreq>');
    expect(xml).toContain('<priority>0.9</priority>');
  });

  it('isValidSitemapXml aceita urlset e sitemapindex', () => {
    const urlset = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntry('https://x.com', '/a', '2026-01-01', 'daily', '1.0')}</urlset>`;
    const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://x.com/sitemap?type=providers</loc></sitemap>
</sitemapindex>`;
    expect(isValidSitemapXml(urlset)).toBe(true);
    expect(isValidSitemapXml(index)).toBe(true);
    expect(isValidSitemapXml('<html></html>')).toBe(false);
  });

  it('rotas SEO-críticas (/categoria, /cidade, /profissional) geram entries válidos', () => {
    const samples = [
      sitemapEntry('https://precisodeum.com.br', '/categoria/eletricista', '2026-04-29', 'daily', '0.9'),
      sitemapEntry('https://precisodeum.com.br', '/cidade/curitiba', '2026-04-29', 'weekly', '0.8'),
      sitemapEntry('https://precisodeum.com.br', '/profissional/joao-silva', '2026-04-29', 'weekly', '0.7'),
    ];
    for (const xml of samples) {
      expect(xml).toMatch(/<loc>https:\/\/precisodeum\.com\.br\//);
      expect(xml).toMatch(/<\/url>/);
    }
  });
});
