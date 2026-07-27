type Loader<T> = () => Promise<T>;

const MAX_IMPORT_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 250;
const dynamicImportErrorPatterns = [
  'chunkloaderror',
  'loading chunk',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'dynamically imported module',
];

const prefetchCache = new Map<string, Promise<unknown>>();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const forceFreshReload = () => {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('__fresh', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
};

const isDynamicImportError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return dynamicImportErrorPatterns.some((pattern) => message.includes(pattern));
};

async function runImportWithRetry<T>(loader: Loader<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_IMPORT_RETRIES; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      const shouldRetry = isDynamicImportError(error) && attempt < MAX_IMPORT_RETRIES - 1;
      if (!shouldRetry) break;
      await sleep(BASE_RETRY_DELAY_MS * 2 ** attempt);
    }
  }

  if (isDynamicImportError(lastError)) {
    const reloadKey = 'lazy_reload_ts';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 10_000) {
      sessionStorage.setItem(reloadKey, String(now));
      forceFreshReload();
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha ao carregar módulo dinâmico.');
}

export function importWithRetry<T>(loader: Loader<T>) {
  // Importe real de rota — nunca fica na fila; usuário está esperando.
  return runImportWithRetry(loader);
}

// ─── Fila de prefetch com concorrência limitada + pausa durante navegação ───
// Objetivo: evitar contender com o download do chunk da rota atual (jank em
// navegação lenta) e cancelar prefetches "obsoletos" quando o usuário muda
// rapidamente de intenção (hover em vários links seguidos).
type PrefetchJob = {
  key: string;
  loader: Loader<unknown>;
  resolve: () => void;
  reject: (err: unknown) => void;
};

let PREFETCH_CONCURRENCY = 2;
let inflight = 0;
let queue: PrefetchJob[] = [];
let pauseUntil = 0;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const scheduleIdle = (cb: () => void, timeout = 1500) => {
  if (typeof window === 'undefined') return void cb();
  const rIC: any = (window as any).requestIdleCallback;
  if (typeof rIC === 'function') rIC(cb, { timeout });
  else setTimeout(cb, 16);
};

const pump = () => {
  if (typeof window === 'undefined') return;
  const wait = pauseUntil - now();
  if (wait > 0) {
    setTimeout(pump, Math.min(wait, 300));
    return;
  }
  while (inflight < PREFETCH_CONCURRENCY && queue.length > 0) {
    const job = queue.shift()!;
    inflight += 1;
    scheduleIdle(() => {
      runImportWithRetry(job.loader)
        .then(() => job.resolve())
        .catch((err) => {
          prefetchCache.delete(job.key);
          job.reject(err);
        })
        .finally(() => {
          inflight = Math.max(0, inflight - 1);
          pump();
        });
    }, 1500);
  }
};

/** Pausa a fila de prefetch por `ms` — usado durante trocas de rota. */
export function pausePrefetching(ms: number) {
  const until = now() + Math.max(0, ms);
  if (until > pauseUntil) pauseUntil = until;
}

/** Cancela prefetches enfileirados (best-effort — imports em voo não abortam). */
export function cancelPendingPrefetches(keepKeys?: Set<string>) {
  if (!queue.length) return;
  const kept: PrefetchJob[] = [];
  for (const job of queue) {
    if (keepKeys && keepKeys.has(job.key)) {
      kept.push(job);
    } else {
      prefetchCache.delete(job.key);
      job.resolve(); // silencia consumidores
    }
  }
  queue = kept;
}

export function setPrefetchConcurrency(n: number) {
  PREFETCH_CONCURRENCY = Math.max(1, Math.min(6, Math.floor(n)));
  pump();
}

export function prefetchImportWithRetry<T>(cacheKey: string, loader: Loader<T>): Promise<void> {
  const existing = prefetchCache.get(cacheKey);
  if (existing) return existing.then(() => undefined);

  const promise = new Promise<void>((resolve, reject) => {
    queue.push({ key: cacheKey, loader: loader as Loader<unknown>, resolve, reject });
  });

  prefetchCache.set(cacheKey, promise);
  pump();
  return promise;
}
