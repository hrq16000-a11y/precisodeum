/**
 * SEO Route Registry — Fase 2.7
 *
 * Registry determinístico das rotas SEO. Fonte única para:
 *  - tipo de landing
 *  - regras de canonical
 *  - elegibilidade indexável
 *  - presença de slot patrocinado
 *  - prioridade no sitemap
 *
 * Não substitui as páginas; serve como contrato compartilhado
 * entre App, sitemap, AdminSeoLandingsPage e SeoLandingEligibility.
 */

export type SeoLandingType =
  | 'home'
  | 'city'
  | 'category'
  | 'category_city'
  | 'service'
  | 'urgency'
  | 'neighborhood'
  | 'comparison';

export interface SeoRouteDefinition {
  /** Identificador estável (slug do tipo). */
  type: SeoLandingType;
  /** Padrão de rota usado pelo react-router. */
  pathPattern: string;
  /** Pode receber bloco patrocinado dedicado. */
  hasSponsorSlot: boolean;
  /** Prioridade base no sitemap (0.0 a 1.0). */
  basePriority: number;
  /** changefreq sugerido. */
  changefreq: 'daily' | 'weekly' | 'monthly';
  /** Exige providers reais para ser indexável. */
  requiresProviders: boolean;
  /** Mínimo de providers para passar no gate de thin-content. */
  minProviders: number;
  /** Habilita bloco de FAQ dinâmico. */
  hasFaq: boolean;
  /** Habilita bloco de internal linking. */
  hasInternalLinks: boolean;
}

export const SEO_ROUTE_REGISTRY: Record<SeoLandingType, SeoRouteDefinition> = {
  home: {
    type: 'home',
    pathPattern: '/',
    hasSponsorSlot: false,
    basePriority: 1.0,
    changefreq: 'daily',
    requiresProviders: false,
    minProviders: 0,
    hasFaq: false,
    hasInternalLinks: true,
  },
  city: {
    type: 'city',
    pathPattern: '/cidade/:citySlug',
    hasSponsorSlot: true,
    basePriority: 0.7,
    changefreq: 'weekly',
    requiresProviders: true,
    minProviders: 1,
    hasFaq: true,
    hasInternalLinks: true,
  },
  category: {
    type: 'category',
    pathPattern: '/categoria/:slug',
    hasSponsorSlot: true,
    basePriority: 0.8,
    changefreq: 'weekly',
    requiresProviders: true,
    minProviders: 1,
    hasFaq: true,
    hasInternalLinks: true,
  },
  category_city: {
    type: 'category_city',
    pathPattern: '/categoria/:slug/em/:citySlug',
    hasSponsorSlot: true,
    basePriority: 0.9,
    changefreq: 'weekly',
    requiresProviders: true,
    minProviders: 1,
    hasFaq: true,
    hasInternalLinks: true,
  },
  service: {
    type: 'service',
    pathPattern: '/servico/:slug',
    hasSponsorSlot: false,
    basePriority: 0.6,
    changefreq: 'monthly',
    requiresProviders: true,
    minProviders: 1,
    hasFaq: false,
    hasInternalLinks: true,
  },
  urgency: {
    type: 'urgency',
    pathPattern: '/urgencia/:slug/em/:citySlug',
    hasSponsorSlot: true,
    basePriority: 0.85,
    changefreq: 'weekly',
    requiresProviders: true,
    minProviders: 2,
    hasFaq: true,
    hasInternalLinks: true,
  },
  neighborhood: {
    type: 'neighborhood',
    pathPattern: '/cidade/:citySlug/bairro/:neighborhoodSlug',
    hasSponsorSlot: false,
    basePriority: 0.5,
    changefreq: 'monthly',
    requiresProviders: true,
    minProviders: 2,
    hasFaq: false,
    hasInternalLinks: true,
  },
  comparison: {
    type: 'comparison',
    pathPattern: '/comparar/:slugA/vs/:slugB',
    hasSponsorSlot: false,
    basePriority: 0.4,
    changefreq: 'monthly',
    requiresProviders: false,
    minProviders: 0,
    hasFaq: false,
    hasInternalLinks: false,
  },
};

export function getSeoRoute(type: SeoLandingType): SeoRouteDefinition {
  return SEO_ROUTE_REGISTRY[type];
}

/**
 * Calcula prioridade dinâmica para sitemap.
 * Considera providers, sponsored e healthy.
 */
export function computeSitemapPriority(
  type: SeoLandingType,
  signals: { providers?: number; sponsored?: boolean; healthy?: boolean } = {},
): number {
  const def = SEO_ROUTE_REGISTRY[type];
  let p = def.basePriority;
  if (signals.sponsored) p = Math.min(1, p + 0.05);
  if (signals.healthy) p = Math.min(1, p + 0.05);
  if (def.requiresProviders && (signals.providers ?? 0) < def.minProviders) {
    p = Math.max(0.1, p - 0.4);
  }
  return Number(p.toFixed(2));
}
