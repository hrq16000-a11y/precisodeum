/**
 * SEO Indexation Guard — Fase 2.8
 *
 * Decisão central de indexação para rotas SEO públicas.
 * Fail-closed: na dúvida → noindex,follow.
 */

import { evaluateLandingEligibility } from '../seoLandingEligibility';
import type { SeoLandingType } from '../seoRouteRegistry';

export interface IndexationInput {
  type: SeoLandingType;
  path: string;
  slug?: string;
  citySlug?: string;
  categorySlug?: string;
  providersCount?: number;
  isOrphan?: boolean;
  hasUsefulContent?: boolean;
  isSponsored?: boolean;
  conversionRate?: number;
  /** Indica busca/parâmetro sem resultados úteis (ex.: /buscar?categoria=lixo). */
  emptySearch?: boolean;
  /** Página gerada dinamicamente sem cobertura no registry. */
  unknownRoute?: boolean;
  /** Parâmetros considerados inválidos pela rota (slug fora do padrão). */
  invalidParams?: boolean;
}

export interface IndexationVerdict {
  index: boolean;
  reasons: string[];
  robots: 'index, follow' | 'noindex, follow' | 'noindex, nofollow';
  canonicalPath: string;
}

/** Remove query string, trailing slash duplicado e normaliza prefixo. */
export function normalizeCanonicalPath(path: string): string {
  if (!path) return '/';
  let p = path.split('#')[0].split('?')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  // Colapsa // → /
  p = p.replace(/\/{2,}/g, '/');
  // Remove trailing slash, exceto raiz
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p.toLowerCase();
}

const ORPHAN_INDEXABLE_TYPES: SeoLandingType[] = [
  'category',
  'category_city',
  'city',
  'neighborhood',
  'urgency',
];

export function shouldNoindex(input: IndexationInput): { noindex: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.emptySearch) reasons.push('empty_search');
  if (input.unknownRoute) reasons.push('unknown_route');
  if (input.invalidParams) reasons.push('invalid_params');
  if (input.isOrphan && ORPHAN_INDEXABLE_TYPES.includes(input.type)) {
    reasons.push('orphan_page');
  }

  const verdict = evaluateLandingEligibility({
    type: input.type,
    slug: input.slug,
    citySlug: input.citySlug,
    categorySlug: input.categorySlug,
    providersCount: input.providersCount,
    hasUsefulContent: input.hasUsefulContent,
    isSponsored: input.isSponsored,
    conversionRate: input.conversionRate,
  });
  if (!verdict.indexable) reasons.push(...verdict.reasons);

  return { noindex: reasons.length > 0, reasons };
}

export function shouldIndex(input: IndexationInput): IndexationVerdict {
  const { noindex, reasons } = shouldNoindex(input);
  const canonicalPath = normalizeCanonicalPath(input.path);
  return {
    index: !noindex,
    reasons,
    robots: noindex ? 'noindex, follow' : 'index, follow',
    canonicalPath,
  };
}

export function shouldCanonicalize(input: IndexationInput): string {
  return normalizeCanonicalPath(input.path);
}
