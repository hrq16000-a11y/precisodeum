/**
 * URL Canonicalization — normalização end-to-end de canônicos e noindex
 * contra variações de URL (trailing slash, caixa alta, parâmetros,
 * duplicação de barras, index.html, redirecionamentos).
 *
 * Objetivo: **nenhuma variação da mesma página pode ficar indexável duas
 * vezes**. Fail-closed: parâmetro desconhecido → não entra no canônico e,
 * quando altera conteúdo, marca noindex.
 *
 * Puro (sem I/O), usável em runtime, edge functions e scripts de build.
 */

import { BRAND } from '@/config/brand';
import { normalizeCanonicalPath, shouldIndex, type IndexationInput, type IndexationVerdict } from './seoIndexationGuard';

/** Parâmetros que fazem parte da identidade da página (entram no canônico). */
export const CANONICAL_QUERY_PARAMS = ['page', 'categoria', 'cidade', 'cep'] as const;

/** Parâmetros de rastreamento: descartados sem penalizar indexação. */
export const TRACKING_QUERY_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'ref',
  'origem',
  '__lovable_load_id',
  '__fresh',
];

/** Parâmetros que geram variação de conteúdo → canonical sem eles + noindex. */
export const FACET_QUERY_PARAMS = ['ordem', 'sort', 'disponivel', 'raio', 'view', 'debug'];

export type UrlIssue =
  | 'uppercase'
  | 'trailing_slash'
  | 'duplicate_slash'
  | 'index_file'
  | 'tracking_params'
  | 'facet_params'
  | 'unknown_params'
  | 'param_order'
  | 'empty_param'
  | 'host_variant'
  | 'insecure_scheme'
  | 'fragment';

export interface NormalizedUrl {
  /** Caminho canônico (sem host, sem barra final, minúsculo). */
  canonicalPath: string;
  /** URL absoluta canônica com a marca configurada. */
  canonicalUrl: string;
  /** Query canônica já ordenada (inclui o "?" quando existir). */
  canonicalQuery: string;
  /** Problemas detectados na URL de entrada. */
  issues: UrlIssue[];
  /** Precisa de redirecionamento 301 servidor→canônico. */
  redirect: { needed: boolean; status: 301 | null; to: string | null };
  /** Motivos que forçam noindex apenas por causa da URL. */
  noindexReasons: string[];
}

const CANONICAL_SET = new Set<string>(CANONICAL_QUERY_PARAMS);
const TRACKING_SET = new Set(TRACKING_QUERY_PARAMS);
const FACET_SET = new Set(FACET_QUERY_PARAMS);

function baseHost(): string {
  try {
    return new URL(BRAND.baseUrl).host.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Normaliza qualquer variação de URL (absoluta ou relativa) para a forma
 * canônica única da marca.
 */
export function normalizeSeoUrl(input: string): NormalizedUrl {
  const issues: UrlIssue[] = [];
  const noindexReasons: string[] = [];
  const raw = (input || '').trim();

  let pathname = raw;
  let search = '';
  let hash = '';
  let inputHost = '';
  let inputScheme = '';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      inputHost = u.host.toLowerCase();
      inputScheme = u.protocol.replace(':', '').toLowerCase();
      pathname = u.pathname;
      search = u.search;
      hash = u.hash;
    } catch {
      pathname = '/';
    }
  } else {
    const hashIdx = raw.indexOf('#');
    if (hashIdx >= 0) {
      hash = raw.slice(hashIdx);
      pathname = raw.slice(0, hashIdx);
    }
    const qIdx = pathname.indexOf('?');
    if (qIdx >= 0) {
      search = pathname.slice(qIdx);
      pathname = pathname.slice(0, qIdx);
    }
  }

  if (hash) issues.push('fragment');
  if (inputScheme === 'http') issues.push('insecure_scheme');
  const expectedHost = baseHost();
  if (inputHost && expectedHost && inputHost !== expectedHost) issues.push('host_variant');

  if (/[A-Z]/.test(pathname)) issues.push('uppercase');
  if (/\/{2,}/.test(pathname)) issues.push('duplicate_slash');
  if (pathname.length > 1 && /\/$/.test(pathname)) issues.push('trailing_slash');
  if (/\/index\.(html?|php)$/i.test(pathname)) {
    issues.push('index_file');
    pathname = pathname.replace(/\/index\.(html?|php)$/i, '/');
  }

  const canonicalPath = normalizeCanonicalPath(pathname);

  // --- query ---
  const params = new URLSearchParams(search);
  const kept: Array<[string, string]> = [];
  const seenOrder: string[] = [];
  let hasTracking = false;
  let hasFacet = false;
  let hasUnknown = false;

  params.forEach((value, key) => {
    const k = key.toLowerCase();
    seenOrder.push(k);
    const v = value.trim();
    if (TRACKING_SET.has(k)) {
      hasTracking = true;
      return;
    }
    if (FACET_SET.has(k)) {
      hasFacet = true;
      return;
    }
    if (!CANONICAL_SET.has(k)) {
      hasUnknown = true;
      return;
    }
    if (!v) {
      if (!issues.includes('empty_param')) issues.push('empty_param');
      return;
    }
    // page=1 é a mesma URL da base
    if (k === 'page' && (v === '1' || v === '0')) return;
    kept.push([k, v.toLowerCase()]);
  });

  if (hasTracking) issues.push('tracking_params');
  if (hasFacet) {
    issues.push('facet_params');
    noindexReasons.push('facet_url_variant');
  }
  if (hasUnknown) {
    issues.push('unknown_params');
    noindexReasons.push('unknown_query_param');
  }

  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const canonicalOrder = kept.map(([k]) => k);
  const keptFromInput = seenOrder.filter((k) => canonicalOrder.includes(k));
  if (keptFromInput.join(',') !== canonicalOrder.join(',')) issues.push('param_order');

  const canonicalQuery = kept.length
    ? `?${kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
    : '';

  const canonicalUrl = `${BRAND.baseUrl}${canonicalPath}${canonicalQuery}`;
  const inputAbsolute = inputHost
    ? `${inputScheme || 'https'}://${inputHost}${pathname}${search}`
    : `${BRAND.baseUrl}${pathname}${search}`;

  const needsRedirect = inputAbsolute !== canonicalUrl;

  return {
    canonicalPath,
    canonicalUrl,
    canonicalQuery,
    issues,
    redirect: {
      needed: needsRedirect,
      status: needsRedirect ? 301 : null,
      to: needsRedirect ? canonicalUrl : null,
    },
    noindexReasons,
  };
}

export interface UrlVariantVerdict extends IndexationVerdict {
  canonicalUrl: string;
  urlIssues: UrlIssue[];
  redirect: NormalizedUrl['redirect'];
}

/**
 * Avaliação combinada: normaliza a URL e aplica o guard de indexação.
 * Qualquer motivo de URL (facet/param desconhecido) força noindex, follow.
 */
export function evaluateUrlVariant(input: Omit<IndexationInput, 'path'> & { path: string }): UrlVariantVerdict {
  const normalized = normalizeSeoUrl(input.path);
  const base = shouldIndex({ ...input, path: normalized.canonicalPath });
  const reasons = [...base.reasons, ...normalized.noindexReasons];
  const index = base.index && normalized.noindexReasons.length === 0;

  return {
    index,
    reasons,
    robots: index ? 'index, follow' : 'noindex, follow',
    canonicalPath: normalized.canonicalPath,
    canonicalUrl: normalized.canonicalUrl,
    urlIssues: normalized.issues,
    redirect: normalized.redirect,
  };
}

export interface DuplicateGroup {
  canonicalUrl: string;
  variants: string[];
}

/**
 * Detecta variações distintas que colapsam no mesmo canônico —
 * insumo do relatório de build (`seo:report`) para eliminar duplicadas.
 */
export function detectDuplicateVariants(urls: string[]): DuplicateGroup[] {
  const map = new Map<string, Set<string>>();
  for (const url of urls) {
    const { canonicalUrl } = normalizeSeoUrl(url);
    if (!map.has(canonicalUrl)) map.set(canonicalUrl, new Set());
    map.get(canonicalUrl)!.add(url);
  }
  return [...map.entries()]
    .filter(([, set]) => set.size > 1)
    .map(([canonicalUrl, set]) => ({ canonicalUrl, variants: [...set].sort() }));
}

/**
 * Gate de build: falha quando duas variações indexáveis apontam para
 * canônicos diferentes da mesma página (duplicata indexável real).
 */
export function auditCanonicalConsistency(
  pages: Array<{ url: string; canonical?: string; noindex?: boolean }>,
): Array<{ url: string; expected: string; found: string | null; kind: 'canonical_mismatch' | 'indexable_duplicate' }> {
  const problems: Array<{
    url: string;
    expected: string;
    found: string | null;
    kind: 'canonical_mismatch' | 'indexable_duplicate';
  }> = [];
  const indexableByCanonical = new Map<string, string>();

  for (const page of pages) {
    const { canonicalUrl } = normalizeSeoUrl(page.url);
    const found = page.canonical ? normalizeSeoUrl(page.canonical).canonicalUrl : null;
    if (found !== null && found !== canonicalUrl) {
      problems.push({ url: page.url, expected: canonicalUrl, found: page.canonical ?? null, kind: 'canonical_mismatch' });
    }
    if (page.noindex) continue;
    const previous = indexableByCanonical.get(canonicalUrl);
    if (previous && previous !== page.url) {
      problems.push({ url: page.url, expected: canonicalUrl, found: previous, kind: 'indexable_duplicate' });
    } else if (!previous) {
      indexableByCanonical.set(canonicalUrl, page.url);
    }
  }

  return problems;
}
