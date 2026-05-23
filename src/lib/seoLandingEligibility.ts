/**
 * SEO Landing Eligibility — Fase 2.7
 *
 * Gate determinístico para indexação de páginas SEO regionais.
 * Protege contra thin-content, doorway pages e index explosion.
 *
 * Uso típico:
 *   const verdict = evaluateLandingEligibility({
 *     type: 'category_city',
 *     slug: 'eletricista',
 *     citySlug: 'curitiba',
 *     providersCount: 12,
 *   });
 *   if (!verdict.indexable) → noindex,follow
 */

import { getSeoRoute, type SeoLandingType } from './seoRouteRegistry';

export type ThinContentReason =
  | 'no_providers'
  | 'below_minimum_providers'
  | 'invalid_slug'
  | 'invalid_city'
  | 'invalid_category'
  | 'missing_content'
  | 'sponsored_only';

export type LandingStatus = 'healthy' | 'thin' | 'sponsored' | 'high_conversion';

export interface LandingEligibilityInput {
  type: SeoLandingType;
  slug?: string;
  citySlug?: string;
  categorySlug?: string;
  providersCount?: number;
  hasUsefulContent?: boolean;
  isSponsored?: boolean;
  /** CTR (clique → lead). Acima de 0.04 considera high_conversion. */
  conversionRate?: number;
}

export interface LandingEligibilityVerdict {
  indexable: boolean;
  status: LandingStatus;
  reasons: ThinContentReason[];
  /** Sugestão de meta robots. */
  robots: 'index, follow' | 'noindex, follow';
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

export function isValidSeoSlug(slug?: string | null): boolean {
  if (!slug) return false;
  if (slug.length > 80) return false;
  return SLUG_RE.test(slug);
}

export function evaluateLandingEligibility(
  input: LandingEligibilityInput,
): LandingEligibilityVerdict {
  const def = getSeoRoute(input.type);
  const reasons: ThinContentReason[] = [];

  // Slug checks
  if (input.slug !== undefined && !isValidSeoSlug(input.slug)) {
    reasons.push('invalid_slug');
  }
  if (input.citySlug !== undefined && !isValidSeoSlug(input.citySlug)) {
    reasons.push('invalid_city');
  }
  if (input.categorySlug !== undefined && !isValidSeoSlug(input.categorySlug)) {
    reasons.push('invalid_category');
  }

  // Providers gate
  if (def.requiresProviders) {
    const count = input.providersCount ?? 0;
    if (count === 0) reasons.push('no_providers');
    else if (count < def.minProviders) reasons.push('below_minimum_providers');
  }

  // Content gate (default true; pages can opt-out explicitly)
  if (input.hasUsefulContent === false) {
    reasons.push('missing_content');
  }

  const indexable = reasons.length === 0;

  let status: LandingStatus = indexable ? 'healthy' : 'thin';
  if (indexable && input.isSponsored) status = 'sponsored';
  if (indexable && (input.conversionRate ?? 0) >= 0.04) status = 'high_conversion';

  return {
    indexable,
    status,
    reasons,
    robots: indexable ? 'index, follow' : 'noindex, follow',
  };
}
