/**
 * SEO Internal Linking Runtime — Fase 2.7
 *
 * Gera blocos de links internos contextuais (cidades próximas,
 * categorias relacionadas, urgências). Determinístico, sem loops,
 * com limites rígidos para evitar keyword stuffing.
 */

import { isValidSeoSlug } from './seoLandingEligibility';

export interface SeoLink {
  label: string;
  href: string;
  /** Categoria semântica para agrupar no UI. */
  group: 'city' | 'category' | 'service' | 'neighborhood' | 'urgency';
}

export interface SeoLinkBlock {
  title: string;
  links: SeoLink[];
}

export const MAX_LINKS_PER_BLOCK = 8;
export const MAX_BLOCKS = 3;

interface BuildRelatedInput {
  currentPath: string;
  citySlug?: string;
  categorySlug?: string;
  relatedCities?: Array<{ name: string; slug: string }>;
  relatedCategories?: Array<{ name: string; slug: string }>;
  relatedNeighborhoods?: Array<{ name: string; slug: string }>;
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

export function buildRelatedLinks(input: BuildRelatedInput): SeoLinkBlock[] {
  const blocks: SeoLinkBlock[] = [];
  const current = input.currentPath;

  // Bloco 1 — cidades relacionadas (sempre que houver categoria)
  if (input.categorySlug && isValidSeoSlug(input.categorySlug) && input.relatedCities?.length) {
    const cityLinks: SeoLink[] = input.relatedCities
      .filter((c) => isValidSeoSlug(c.slug))
      .slice(0, MAX_LINKS_PER_BLOCK)
      .map((c) => ({
        label: c.name,
        href: `/categoria/${input.categorySlug}/em/${c.slug}`,
        group: 'city' as const,
      }));
    const filtered = dedupeLinks(cityLinks).filter((l) => l.href !== current);
    if (filtered.length) {
      blocks.push({ title: 'Outras cidades atendidas', links: filtered });
    }
  }

  // Bloco 2 — categorias relacionadas na mesma cidade
  if (input.citySlug && isValidSeoSlug(input.citySlug) && input.relatedCategories?.length) {
    const catLinks: SeoLink[] = input.relatedCategories
      .filter((c) => isValidSeoSlug(c.slug))
      .slice(0, MAX_LINKS_PER_BLOCK)
      .map((c) => ({
        label: c.name,
        href: `/categoria/${c.slug}/em/${input.citySlug}`,
        group: 'category' as const,
      }));
    const filtered = dedupeLinks(catLinks).filter((l) => l.href !== current);
    if (filtered.length) {
      blocks.push({ title: 'Serviços relacionados nesta cidade', links: filtered });
    }
  }

  // Bloco 3 — bairros próximos (somente cidade base)
  if (input.citySlug && isValidSeoSlug(input.citySlug) && input.relatedNeighborhoods?.length) {
    const nLinks: SeoLink[] = input.relatedNeighborhoods
      .filter((n) => isValidSeoSlug(n.slug))
      .slice(0, MAX_LINKS_PER_BLOCK)
      .map((n) => ({
        label: n.name,
        href: `/cidade/${input.citySlug}/bairro/${n.slug}`,
        group: 'neighborhood' as const,
      }));
    const filtered = dedupeLinks(nLinks).filter((l) => l.href !== current);
    if (filtered.length) {
      blocks.push({ title: 'Bairros próximos', links: filtered });
    }
  }

  return blocks.slice(0, MAX_BLOCKS);
}
