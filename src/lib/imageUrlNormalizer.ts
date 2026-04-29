/**
 * Pipeline de normalização e validação de URLs de imagens (avatar, portfólio,
 * social/OG). Garante URLs absolutas, registra falhas em console + buffer
 * em memória para diagnóstico (também acessível via window.__imageFailures).
 *
 * Não faz I/O síncrono — validateImageUrl é assíncrono e usa HEAD com
 * fallback para Image() probe. Mantém um cache leve para evitar repetir.
 */

import { toAbsoluteSiteUrl, DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL } from '@/lib/siteAssets';

type FailureReason = 'invalid' | 'http_error' | 'load_error' | 'timeout';

export interface ImageFailureEntry {
  url: string;
  context: string;
  reason: FailureReason;
  status?: number;
  at: string;
}

const FAILURES: ImageFailureEntry[] = [];
const MAX_FAILURES = 50;

const validationCache = new Map<string, boolean>();

if (typeof window !== 'undefined') {
  // Exposto para diagnóstico no console do navegador
  (window as any).__imageFailures = FAILURES;
}

export function getImageFailures(): ImageFailureEntry[] {
  return [...FAILURES];
}

function recordFailure(entry: Omit<ImageFailureEntry, 'at'>): void {
  const full: ImageFailureEntry = { ...entry, at: new Date().toISOString() };
  FAILURES.push(full);
  if (FAILURES.length > MAX_FAILURES) FAILURES.splice(0, FAILURES.length - MAX_FAILURES);
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[image-normalizer]', full);
  }
}

/**
 * Normaliza uma URL de imagem para sempre ser absoluta. Retorna `null`
 * para entradas vazias/inválidas e registra a falha.
 */
export function normalizeImageUrl(
  url: string | null | undefined,
  context = 'unknown',
): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;

  // data: URIs são válidas como estão
  if (raw.startsWith('data:image/')) return raw;

  // blob: e javascript: nunca devem ser usados em SEO/social
  if (raw.startsWith('blob:') || raw.startsWith('javascript:')) {
    recordFailure({ url: raw, context, reason: 'invalid' });
    return null;
  }

  try {
    const absolute = toAbsoluteSiteUrl(raw);
    // Sanity check
    if (!/^https?:\/\//i.test(absolute)) {
      recordFailure({ url: raw, context, reason: 'invalid' });
      return null;
    }
    return absolute;
  } catch {
    recordFailure({ url: raw, context, reason: 'invalid' });
    return null;
  }
}

/**
 * Normaliza para uso em meta og:image — absoluto, com fallback determinístico
 * para a imagem social padrão do site quando inválido.
 */
export function normalizeSocialImageUrl(
  url: string | null | undefined,
  context = 'social',
): string {
  return normalizeImageUrl(url, context) || DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL;
}

/**
 * Valida se a URL é carregável. Tenta HEAD primeiro (rápido, baixo custo),
 * com fallback para Image() probe quando CORS bloqueia.
 *
 * Cache: resultados são memoizados para a sessão.
 */
export async function validateImageUrl(
  url: string,
  context = 'unknown',
  timeoutMs = 1500,
): Promise<boolean> {
  if (!url) return false;
  if (validationCache.has(url)) return validationCache.get(url)!;

  // HEAD com timeout
  if (typeof fetch === 'function' && typeof AbortController !== 'undefined') {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'HEAD', signal: ctl.signal, cache: 'force-cache' });
      clearTimeout(t);
      if (res.ok) {
        validationCache.set(url, true);
        return true;
      }
      recordFailure({ url, context, reason: 'http_error', status: res.status });
    } catch {
      clearTimeout(t);
      // CORS/rede — cai para probe
    }
  }

  // Image() probe — funciona mesmo com CORS restrito
  if (typeof Image === 'undefined') {
    validationCache.set(url, false);
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const img = new Image();
    const t = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      recordFailure({ url, context, reason: 'timeout' });
      validationCache.set(url, false);
      resolve(false);
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(t);
      validationCache.set(url, true);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(t);
      recordFailure({ url, context, reason: 'load_error' });
      validationCache.set(url, false);
      resolve(false);
    };
    img.src = url;
  });
}
