/**
 * Cache com revalidação incremental (ISR-like) para artefatos SEO:
 * sitemap, robots.txt e payloads de páginas SEO.
 *
 * Regras de consistência (não negociáveis):
 * - A chave de cache inclui canônico, noindex e cidade — trocar qualquer um
 *   desses gera OUTRA entrada, então nunca servimos canônico/robots errado.
 * - Entrada expirada pode ser servida como `stale` enquanto revalida em
 *   background (stale-while-revalidate), mas nunca depois de `staleTtlMs`.
 * - ETag é derivado do conteúdo — 304 só quando o corpo é idêntico.
 *
 * 100% puro/isomórfico: sem DOM, sem rede, sem dependência de React.
 */

export interface SeoCacheKeyInput {
  /** Caminho canônico da rota (ou tipo de sitemap). */
  path: string;
  /** Canônico absoluto emitido pela página. */
  canonical?: string;
  /** Se a página é noindex. */
  noindex?: boolean;
  /** Cidade/segmento que altera o conteúdo. */
  city?: string | null;
  /** Variantes extras (page, filtros indexáveis, guide mode...). */
  variant?: Record<string, string | number | boolean | null | undefined>;
}

/** Chave determinística e estável (ordena as variantes). */
export function seoCacheKey(input: SeoCacheKeyInput): string {
  const variant = Object.entries(input.variant || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return [
    input.path,
    `canonical=${input.canonical || ''}`,
    `noindex=${input.noindex ? 1 : 0}`,
    `city=${(input.city || '').toLowerCase()}`,
    variant,
  ]
    .filter(Boolean)
    .join('|');
}

/** Hash FNV-1a 32-bit — barato e determinístico (mesmo algoritmo do engine). */
export function contentHash(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** ETag forte derivado do conteúdo. */
export function computeEtag(content: string): string {
  return `"${contentHash(content)}-${content.length.toString(16)}"`;
}

export interface SeoCacheEntry<T = string> {
  value: T;
  etag: string;
  storedAt: number;
  /** Metadados que precisam bater com a requisição atual. */
  meta: { canonical?: string; noindex?: boolean };
}

export type SeoCacheState = 'miss' | 'fresh' | 'stale' | 'expired';

export interface SeoCacheLookup<T = string> {
  state: SeoCacheState;
  entry?: SeoCacheEntry<T>;
  /** true quando o caller deve revalidar (em background se `stale`). */
  shouldRevalidate: boolean;
}

export interface SeoCacheOptions {
  /** Janela em que a entrada é considerada fresca. */
  ttlMs?: number;
  /** Janela adicional em que a entrada pode ser servida como stale. */
  staleTtlMs?: number;
  /** Máximo de entradas (LRU simples). */
  maxEntries?: number;
  /** Relógio injetável (testes). */
  now?: () => number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h
const DEFAULT_STALE_MS = 6 * 60 * 60 * 1000; // +6h servindo stale

/**
 * Cache em memória com revalidação incremental.
 * Uso típico: `const hit = cache.lookup(key); if (hit.state === 'fresh') ...`
 */
export class SeoIncrementalCache<T = string> {
  private store = new Map<string, SeoCacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly staleTtlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: SeoCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.staleTtlMs = options.staleTtlMs ?? DEFAULT_STALE_MS;
    this.maxEntries = options.maxEntries ?? 500;
    this.now = options.now ?? (() => Date.now());
  }

  lookup(key: string, expect?: { canonical?: string; noindex?: boolean }): SeoCacheLookup<T> {
    const entry = this.store.get(key);
    if (!entry) return { state: 'miss', shouldRevalidate: true };

    // Consistência: canônico/noindex divergentes invalidam a entrada.
    if (expect) {
      const canonicalMismatch =
        expect.canonical !== undefined && expect.canonical !== entry.meta.canonical;
      const noindexMismatch =
        expect.noindex !== undefined && !!expect.noindex !== !!entry.meta.noindex;
      if (canonicalMismatch || noindexMismatch) {
        this.store.delete(key);
        return { state: 'miss', shouldRevalidate: true };
      }
    }

    const age = this.now() - entry.storedAt;
    if (age <= this.ttlMs) {
      // refresh LRU
      this.store.delete(key);
      this.store.set(key, entry);
      return { state: 'fresh', entry, shouldRevalidate: false };
    }
    if (age <= this.ttlMs + this.staleTtlMs) {
      return { state: 'stale', entry, shouldRevalidate: true };
    }
    this.store.delete(key);
    return { state: 'expired', shouldRevalidate: true };
  }

  set(key: string, value: T, meta: SeoCacheEntry<T>['meta'] = {}): SeoCacheEntry<T> {
    const entry: SeoCacheEntry<T> = {
      value,
      etag: computeEtag(typeof value === 'string' ? value : JSON.stringify(value)),
      storedAt: this.now(),
      meta,
    };
    this.store.delete(key);
    this.store.set(key, entry);
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
    return entry;
  }

  /** Invalida por chave exata ou por prefixo (ex.: todas as páginas de uma cidade). */
  invalidate(keyOrPrefix: string, { prefix = false } = {}): number {
    if (!prefix) return this.store.delete(keyOrPrefix) ? 1 : 0;
    let removed = 0;
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

export interface CacheHeaderOptions {
  ttlSeconds?: number;
  staleWhileRevalidateSeconds?: number;
  noindex?: boolean;
  etag?: string;
}

/**
 * Headers HTTP de cache coerentes com a política acima.
 * Páginas noindex nunca são cacheadas em CDN pública.
 */
export function buildSeoCacheHeaders(options: CacheHeaderOptions = {}): Record<string, string> {
  const ttl = Math.max(0, Math.floor(options.ttlSeconds ?? 3600));
  const swr = Math.max(0, Math.floor(options.staleWhileRevalidateSeconds ?? ttl * 6));
  const headers: Record<string, string> = {
    'Cache-Control': options.noindex
      ? 'private, no-store'
      : `public, max-age=${Math.min(ttl, 300)}, s-maxage=${ttl}, stale-while-revalidate=${swr}`,
  };
  if (options.etag) headers.ETag = options.etag;
  if (options.noindex) headers['X-Robots-Tag'] = 'noindex, nofollow';
  return headers;
}

/** true quando o If-None-Match do cliente casa com o ETag atual (responder 304). */
export function isNotModified(ifNoneMatch: string | null | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(',')
    .map((t) => t.trim().replace(/^W\//, ''))
    .includes(etag.replace(/^W\//, ''));
}
