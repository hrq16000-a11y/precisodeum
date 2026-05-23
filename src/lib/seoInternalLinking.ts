/**
 * SEO Internal Linking Runtime — Fase 2.7 + 2.8
 *
 * Gera blocos de links internos contextuais (cidades próximas,
 * categorias relacionadas, urgências, providers de alta conversão,
 * trending searches). Determinístico, com cap global e priorização.
 */

import { isValidSeoSlug } from './seoLandingEligibility';

export interface SeoLink {
  label: string;
  href: string;
  /** Categoria semântica para agrupar no UI. */
  group: 'city' | 'category' | 'service' | 'neighborhood' | 'urgency' | 'provider' | 'trending';
  /** Score 0..1 para priorização (Fase 2.8). */
  priority?: number;
}

export interface SeoLinkBlock {
  title: string;
  links: SeoLink[];
}

export const MAX_LINKS_PER_BLOCK = 8;
export const MAX_BLOCKS = 3;
/** Cap global de links em todos os blocos somados (Fase 2.8). */
export const MAX_TOTAL_LINKS = 24;
/** Profundidade máxima permitida em paths internos. */
export const MAX_LINK_DEPTH = 3;

interface BuildRelatedInput {
  currentPath: string;
  citySlug?: string;
  categorySlug?: string;
  relatedCities?: Array<{ name: string; slug: string; signals?: LinkSignals }>;
  relatedCategories?: Array<{ name: string; slug: string; signals?: LinkSignals }>;
  relatedNeighborhoods?: Array<{ name: string; slug: string; signals?: LinkSignals }>;
  nearbyCities?: Array<{ name: string; slug: string; distanceKm?: number; signals?: LinkSignals }>;
  highConversionProviders?: Array<{ name: string; slug: string; signals?: LinkSignals }>;
  trendingSearches?: Array<{ label: string; slug: string; signals?: LinkSignals }>;
  /** Slugs considerados thin pelo guard — não vira link. */
  thinPaths?: Set<string>;
}

export interface LinkSignals {
  ctr?: number;
  leads?: number;
  trafficViews?: number;
  isSponsored?: boolean;
  conversionRate?: number;
  isEligible?: boolean;
}

/**
 * Score de prioridade 0..1 para links internos (Fase 2.8).
 * Combina CTR/leads/sponsor/conversão/tráfego/elegibilidade SEO.
 * Fail-closed: sem elegibilidade → 0.
 */
export function internalLinkPriority(signals?: LinkSignals): number {
  if (!signals) return 0.4; // base neutra
  if (signals.isEligible === false) return 0;
  let score = 0.3;
  if (signals.ctr !== undefined) score += Math.min(0.2, signals.ctr * 2); // CTR 0.1 → +0.2
  if (signals.conversionRate !== undefined) {
    score += Math.min(0.15, signals.conversionRate * 3);
  }
  if (signals.leads !== undefined) score += Math.min(0.15, signals.leads / 100);
  if (signals.trafficViews !== undefined) {
    score += Math.min(0.1, Math.log10(1 + signals.trafficViews) / 10);
  }
  if (signals.isSponsored) score += 0.1;
  return Math.max(0, Math.min(1, score));
}

function pathDepth(href: string): number {
  return href.split('/').filter(Boolean).length;
}

function dedupeLinks(links: SeoLink[]): SeoLink[] {
  const seen = new Set<string>();
  const out: SeoLink[] = [];
  for (const l of links) {
    if (seen.has(l.href)) continue;
    seen.add(l.href);
    out.push(l);
  }
  return out;
}

function rankAndCap(links: SeoLink[], cap: number): SeoLink[] {
  return [...links]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, cap);
}

function filterValid(
  links: SeoLink[],
  currentPath: string,
  thinPaths?: Set<string>,
): SeoLink[] {
  return links.filter(
    (l) =>
      l.href !== currentPath &&
      pathDepth(l.href) <= MAX_LINK_DEPTH &&
      !(thinPaths && thinPaths.has(l.href)),
  );
}

export function buildRelatedLinks(input: BuildRelatedInput): SeoLinkBlock[] {
  const blocks: SeoLinkBlock[] = [];
  const current = input.currentPath;
  const thin = input.thinPaths;

  // Bloco 1 — cidades relacionadas (categoria + cidades atendidas)
  if (input.categorySlug && isValidSeoSlug(input.categorySlug) && input.relatedCities?.length) {
    const links: SeoLink[] = input.relatedCities
      .filter((c) => isValidSeoSlug(c.slug))
      .map((c) => ({
        label: c.name,
        href: `/categoria/${input.categorySlug}/em/${c.slug}`,
        group: 'city' as const,
        priority: internalLinkPriority(c.signals),
      }));
    const filtered = rankAndCap(
      filterValid(dedupeLinks(links), current, thin),
      MAX_LINKS_PER_BLOCK,
    );
    if (filtered.length) blocks.push({ title: 'Outras cidades atendidas', links: filtered });
  }

  // Bloco 2 — categorias relacionadas na mesma cidade
  if (input.citySlug && isValidSeoSlug(input.citySlug) && input.relatedCategories?.length) {
    const links: SeoLink[] = input.relatedCategories
      .filter((c) => isValidSeoSlug(c.slug))
      .map((c) => ({
        label: c.name,
        href: `/categoria/${c.slug}/em/${input.citySlug}`,
        group: 'category' as const,
        priority: internalLinkPriority(c.signals),
      }));
    const filtered = rankAndCap(
      filterValid(dedupeLinks(links), current, thin),
      MAX_LINKS_PER_BLOCK,
    );
    if (filtered.length) blocks.push({ title: 'Serviços relacionados nesta cidade', links: filtered });
  }

  // Bloco 3 — cidades próximas (geográficas) — Fase 2.8
  if (input.categorySlug && isValidSeoSlug(input.categorySlug) && input.nearbyCities?.length) {
    const links: SeoLink[] = input.nearbyCities
      .filter((c) => isValidSeoSlug(c.slug))
      .map((c) => ({
        label: c.distanceKm != null ? `${c.name} (${Math.round(c.distanceKm)} km)` : c.name,
        href: `/categoria/${input.categorySlug}/em/${c.slug}`,
        group: 'city' as const,
        priority: internalLinkPriority(c.signals),
      }));
    const filtered = rankAndCap(
      filterValid(dedupeLinks(links), current, thin),
      MAX_LINKS_PER_BLOCK,
    );
    if (filtered.length) blocks.push({ title: 'Cidades próximas', links: filtered });
  }

  // Bloco 4 — bairros próximos (só se ainda houver espaço)
  if (
    blocks.length < MAX_BLOCKS &&
    input.citySlug &&
    isValidSeoSlug(input.citySlug) &&
    input.relatedNeighborhoods?.length
  ) {
    const links: SeoLink[] = input.relatedNeighborhoods
      .filter((n) => isValidSeoSlug(n.slug))
      .map((n) => ({
        label: n.name,
        href: `/cidade/${input.citySlug}/bairro/${n.slug}`,
        group: 'neighborhood' as const,
        priority: internalLinkPriority(n.signals),
      }));
    const filtered = rankAndCap(
      filterValid(dedupeLinks(links), current, thin),
      MAX_LINKS_PER_BLOCK,
    );
    if (filtered.length) blocks.push({ title: 'Bairros próximos', links: filtered });
  }

  // Bloco 5 — providers de alta conversão (substitui slot se sobrar)
  if (blocks.length < MAX_BLOCKS && input.highConversionProviders?.length) {
    const links: SeoLink[] = input.highConversionProviders
      .filter((p) => isValidSeoSlug(p.slug))
      .map((p) => ({
        label: p.name,
        href: `/profissional/${p.slug}`,
        group: 'provider' as const,
        priority: internalLinkPriority(p.signals),
      }));
    const filtered = rankAndCap(
      filterValid(dedupeLinks(links), current, thin),
      MAX_LINKS_PER_BLOCK,
    );
    if (filtered.length) blocks.push({ title: 'Profissionais em destaque', links: filtered });
  }

  // Bloco 6 — buscas em tendência
  if (blocks.length < MAX_BLOCKS && input.trendingSearches?.length) {
    const links: SeoLink[] = input.trendingSearches
      .filter((t) => isValidSeoSlug(t.slug))
      .map((t) => ({
        label: t.label,
        href: `/categoria/${t.slug}`,
        group: 'trending' as const,
        priority: internalLinkPriority(t.signals),
      }));
    const filtered = rankAndCap(
      filterValid(dedupeLinks(links), current, thin),
      MAX_LINKS_PER_BLOCK,
    );
    if (filtered.length) blocks.push({ title: 'Buscas em tendência', links: filtered });
  }

  // Cap global de blocos
  const capped = blocks.slice(0, MAX_BLOCKS);

  // Cap global de links (Fase 2.8)
  let remaining = MAX_TOTAL_LINKS;
  return capped
    .map((b) => {
      const take = Math.max(0, Math.min(b.links.length, remaining));
      remaining -= take;
      return { ...b, links: b.links.slice(0, take) };
    })
    .filter((b) => b.links.length > 0);
}
