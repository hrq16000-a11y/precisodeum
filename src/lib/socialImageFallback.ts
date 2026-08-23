/**
 * socialImageFallback — resolução de og:image com lista de candidatos.
 *
 * Permite passar `ogImage` como string OU array. Tentamos cada URL na ordem
 * (HEAD com timeout curto, com fallback para probe via <img>) e usamos a
 * primeira válida. Se nenhuma responder, caímos em `/social-image.png`.
 *
 * Logs de debug opcionais: ative com `?seoDebug=1` na URL ou
 * `localStorage.setItem('seo_debug', '1')`. Mostram status HEAD e o motivo do
 * fallback — útil para diagnosticar em produção sem poluir o console de todos.
 */
import { DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL } from '@/lib/siteAssets';
import { normalizeSocialImageUrl } from '@/lib/imageUrlNormalizer';

export type SocialImageReason =
  | 'ok'
  | 'http_error'
  | 'network_error'
  | 'timeout'
  | 'empty_candidates'
  | 'default';

export interface SocialImageResolution {
  url: string;
  reason: SocialImageReason;
  /** Índice do candidato aceito (-1 quando caiu no default). */
  index: number;
  status?: number;
  attempts: Array<{ url: string; status?: number; reason: SocialImageReason }>;
}

export function isSeoDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('seoDebug') === '1') return true;
    return window.localStorage?.getItem('seo_debug') === '1';
  } catch {
    return false;
  }
}

export function seoDebugLog(message: string, detail?: unknown): void {
  if (!isSeoDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(`[seo:image] ${message}`, detail ?? '');
}

/** Normaliza entrada (string | array) em lista de URLs absolutas únicas. */
export function toSocialImageCandidates(input?: string | string[] | null): string[] {
  const list = Array.isArray(input) ? input : [input];
  const out: string[] = [];
  for (const raw of list) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const normalized = normalizeSocialImageUrl(value, 'og:image');
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

async function probeWithImage(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') return false;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Testa candidatos em ordem e devolve a primeira URL válida.
 * Nunca lança — sempre retorna algo utilizável.
 */
export async function resolveSocialImage(
  input?: string | string[] | null,
  opts: { timeoutMs?: number; fallback?: string } = {},
): Promise<SocialImageResolution> {
  const fallback = opts.fallback || DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL;
  const timeoutMs = opts.timeoutMs ?? 1200;
  const candidates = toSocialImageCandidates(input);
  const attempts: SocialImageResolution['attempts'] = [];

  if (candidates.length === 0) {
    seoDebugLog('sem candidatos — usando default', { fallback });
    return { url: fallback, reason: 'empty_candidates', index: -1, attempts };
  }

  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];
    if (url === fallback) {
      seoDebugLog('candidato já é o default', { url });
      return { url, reason: 'ok', index: i, attempts };
    }

    if (typeof fetch === 'function' && typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'force-cache', signal: controller.signal });
        clearTimeout(timer);
        seoDebugLog('HEAD', { url, status: res.status, ok: res.ok });
        if (res.ok) {
          return { url, reason: 'ok', index: i, status: res.status, attempts };
        }
        attempts.push({ url, status: res.status, reason: 'http_error' });
        continue;
      } catch (err) {
        clearTimeout(timer);
        const aborted = (err as Error)?.name === 'AbortError';
        seoDebugLog(aborted ? 'HEAD timeout' : 'HEAD falhou', { url, error: String(err) });
        // Rede/CORS podem bloquear HEAD mesmo com imagem válida → probe visual.
        const okViaImage = await probeWithImage(url);
        seoDebugLog('probe <img>', { url, ok: okViaImage });
        if (okViaImage) return { url, reason: 'ok', index: i, attempts };
        attempts.push({ url, reason: aborted ? 'timeout' : 'network_error' });
        continue;
      }
    }

    const okViaImage = await probeWithImage(url);
    seoDebugLog('probe <img> (sem fetch)', { url, ok: okViaImage });
    if (okViaImage) return { url, reason: 'ok', index: i, attempts };
    attempts.push({ url, reason: 'network_error' });
  }

  seoDebugLog('todos os candidatos falharam — fallback', { attempts, fallback });
  return { url: fallback, reason: 'default', index: -1, attempts };
}
