/**
 * Sitemap e robots.txt no modo "guia comercial".
 *
 * No modo guia, o portal expõe apenas catálogo, páginas de conteúdo e
 * formulário de lead. Este módulo é a fonte única para decidir QUAIS rotas
 * entram no sitemap e QUAIS ficam bloqueadas no robots.txt nesse modo.
 *
 * Puro e determinístico: nenhuma chamada de rede, nenhum acesso ao DOM.
 * Fora do modo guia, o comportamento é o do portal completo (nada é removido).
 */

import { BRAND_BASE_URL } from '@/config/brand';
import { isFeatureEnabled, type GuideFeature } from '@/config/guideMode';
import { normalizeCanonicalPath } from './seoIndexationGuard';

export interface GuideSitemapEntry {
  path: string;
  /** Recurso do modo guia ao qual a rota pertence. */
  feature: GuideFeature;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: string;
  /** Rota marcada como noindex pela strategy — nunca entra no sitemap. */
  noindex?: boolean;
}

export interface GuideSitemapResult {
  included: GuideSitemapEntry[];
  excluded: Array<GuideSitemapEntry & { reason: 'feature_disabled' | 'noindex' }>;
  /** URLs absolutas prontas para o <loc>. */
  urls: string[];
}

/** Prefixos de rota por recurso — usado para classificar paths e montar robots. */
export const GUIDE_FEATURE_PREFIXES: Record<GuideFeature, string[]> = {
  catalog: ['/categoria', '/categorias', '/cidade', '/cidades', '/bairro', '/buscar', '/profissional', '/especialidades', '/servico', '/servicos', '/popular'],
  content_pages: ['/institucional', '/ajuda', '/faq', '/sobre', '/como-funciona'],
  lead_form: ['/contato', '/orcamento'],
  sponsors: ['/patrocinador', '/anuncie', '/quero-ser-patrocinador', '/espacos-patrocinio'],
  blog: ['/blog'],
  provider_dashboard: ['/dashboard'],
  chat: ['/chat'],
  jobs: ['/vagas', '/vaga'],
  courses: ['/cursos'],
  gamification: ['/ranking', '/conquistas'],
  notifications: ['/notificacoes'],
};

/** Classifica um path na feature de guia correspondente ('catalog' como fallback). */
export function classifyGuidePath(path: string): GuideFeature {
  const normalized = normalizeCanonicalPath(path);
  let best: { feature: GuideFeature; len: number } | null = null;
  for (const [feature, prefixes] of Object.entries(GUIDE_FEATURE_PREFIXES) as Array<[GuideFeature, string[]]>) {
    for (const prefix of prefixes) {
      if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
        if (!best || prefix.length > best.len) best = { feature, len: prefix.length };
      }
    }
  }
  return best?.feature ?? 'catalog';
}

/**
 * Filtra entradas do sitemap respeitando o modo guia e a strategy de noindex.
 */
export function buildGuideSitemap(
  entries: GuideSitemapEntry[],
  options: { baseUrl?: string; isEnabled?: (f: GuideFeature) => boolean } = {},
): GuideSitemapResult {
  const baseUrl = (options.baseUrl || BRAND_BASE_URL).replace(/\/+$/, '');
  const enabled = options.isEnabled || isFeatureEnabled;
  const included: GuideSitemapEntry[] = [];
  const excluded: GuideSitemapResult['excluded'] = [];

  for (const entry of entries) {
    const normalized = { ...entry, path: normalizeCanonicalPath(entry.path) };
    if (normalized.noindex) {
      excluded.push({ ...normalized, reason: 'noindex' });
      continue;
    }
    if (!enabled(normalized.feature)) {
      excluded.push({ ...normalized, reason: 'feature_disabled' });
      continue;
    }
    included.push(normalized);
  }

  return { included, excluded, urls: included.map((e) => `${baseUrl}${e.path}`) };
}

/** Canônico absoluto de uma rota, sempre derivado do brand config. */
export function guideCanonical(path: string, baseUrl = BRAND_BASE_URL): string {
  return `${baseUrl.replace(/\/+$/, '')}${normalizeCanonicalPath(path)}`;
}

/**
 * Gera o robots.txt do modo guia: mantém o catálogo e o conteúdo abertos e
 * bloqueia toda rota de recurso desligado (evita crawl budget desperdiçado).
 */
export function buildGuideRobotsTxt(
  options: { baseUrl?: string; isEnabled?: (f: GuideFeature) => boolean; extraDisallow?: string[] } = {},
): string {
  const baseUrl = (options.baseUrl || BRAND_BASE_URL).replace(/\/+$/, '');
  const enabled = options.isEnabled || isFeatureEnabled;

  const disallow = new Set<string>([
    '/admin/',
    '/dashboard/',
    '/login',
    '/reset-password',
    '/preview/',
    ...(options.extraDisallow || []),
  ]);

  for (const [feature, prefixes] of Object.entries(GUIDE_FEATURE_PREFIXES) as Array<[GuideFeature, string[]]>) {
    if (enabled(feature)) continue;
    prefixes.forEach((p) => disallow.add(`${p}/`));
  }

  return [
    'User-agent: *',
    'Allow: /',
    ...[...disallow].sort().map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}
