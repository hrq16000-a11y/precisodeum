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

  throw lastError instanceof Error ? lastError : new Error('Falha ao carregar módulo dinâmico.');
}

export function importWithRetry<T>(loader: Loader<T>) {
  return runImportWithRetry(loader);
}

export function prefetchImportWithRetry<T>(cacheKey: string, loader: Loader<T>): Promise<void> {
  const existing = prefetchCache.get(cacheKey);
  if (existing) return existing.then(() => undefined);

  const request = runImportWithRetry(loader)
    .then(() => undefined)
    .catch((error) => {
      prefetchCache.delete(cacheKey);
      throw error;
    });

  prefetchCache.set(cacheKey, request);
  return request;
}