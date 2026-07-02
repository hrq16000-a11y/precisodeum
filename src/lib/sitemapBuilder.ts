/**
 * Helpers puros para construção de sitemaps (URL entries, paginação, validação).
 *
 * Vivem em src/lib para que possam ser testados com vitest sem precisar do Deno
 * runtime das edge functions. A função `entry()` e `escapeXml()` aqui são
 * cópias 1:1 das versões usadas em supabase/functions/sitemap/index.ts —
 * o teste de paridade (sitemap-pagination.test.ts) garante que os formatos
 * permanecem alinhados.
 */

export const SITEMAP_PAGE_SIZE = 5000;

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!),
  );
}

export function sitemapEntry(
  base: string,
  path: string,
  lastmod: string,
  changefreq: string,
  priority: string,
): string {
  return `  <url>
    <loc>${escapeXml(base)}${escapeXml(path)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>\n`;
}

/**
 * Divide uma lista de URLs em páginas de no máx. SITEMAP_PAGE_SIZE entradas.
 * Retorna `[]` quando a lista está vazia (caller decide se ainda emite página 1).
 */
export function paginate<T>(items: T[], pageSize = SITEMAP_PAGE_SIZE): T[][] {
  if (items.length === 0) return [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

/**
 * Quantas páginas serão geradas para um sub-sitemap. Sempre >= 1 para que o
 * índice principal não fique sem `<sitemap>` quando o tipo está vazio.
 */
export function pageCount(total: number, pageSize = SITEMAP_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Monta a URL do sub-sitemap. Quando há mais de uma página, anexa `&page=N`.
 */
export function subSitemapUrl(base: string, type: string, page: number): string {
  if (page <= 1) return `${base}?type=${type}`;
  return `${base}?type=${type}&page=${page}`;
}

/** Validação rasa: garante que o XML possui declaração e raiz urlset/sitemapindex. */
export function isValidSitemapXml(xml: string): boolean {
  if (!xml.startsWith('<?xml')) return false;
  return /<(urlset|sitemapindex)\b/.test(xml) && /<\/(urlset|sitemapindex)>/.test(xml);
}
