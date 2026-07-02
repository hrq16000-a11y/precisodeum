/**
 * Cities Index — SHELL (PR 4 · externalização do dataset).
 *
 * Antes: arquivo único de ~258KB / ~5.300 LOC carregado SÍNCRONO no bundle
 * principal (bundle-bomb estrutural).
 *
 * Agora: este shell mantém a API pública (tipos + funções) e carrega o
 * dataset **sob demanda** via `import('./citiesIndexData')`. O Vite emite
 * o dataset em um chunk separado, fora do bundle síncrono inicial.
 *
 * Regras:
 *   - NUNCA importe `./citiesIndexData` diretamente; use sempre este shell.
 *   - Funções síncronas (`isKnownCity`, `lookupCity`) são FAIL-OPEN
 *     enquanto o dataset não terminou de carregar — disparam o preload em
 *     background e retornam um default seguro (true / null).
 *   - Para comportamento estrito, faça `await preloadCitiesIndex()` antes.
 */

export type { CityEntry } from './citiesIndexData';
import type { CityEntry } from './citiesIndexData';

// ─── UF whitelist (set pequeno, mantido síncrono) ────────────────────────
const VALID_UFS = new Set([
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms',
  'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc',
  'sp', 'se', 'to',
]);

export function isValidUF(s: string): boolean {
  return VALID_UFS.has(s.toLowerCase());
}

// ─── Lazy loader (módulo-level cache) ────────────────────────────────────
let _data: Record<string, CityEntry[]> | null = null;
let _loading: Promise<Record<string, CityEntry[]>> | null = null;

/**
 * Carrega o dataset (chunk separado) e o memoiza. Idempotente — chamadas
 * concorrentes compartilham a mesma Promise.
 */
export function preloadCitiesIndex(): Promise<Record<string, CityEntry[]>> {
  if (_data) return Promise.resolve(_data);
  if (!_loading) {
    _loading = import('./citiesIndexData').then((m) => {
      _data = m.default;
      return _data;
    });
  }
  return _loading;
}

/**
 * Versão síncrona do dataset. Retorna `{}` enquanto o lazy load não
 * terminou. Os consumidores devem chamar `preloadCitiesIndex()` antes
 * caso precisem do conteúdo real.
 *
 * @deprecated Use `preloadCitiesIndex()` para garantir o dataset carregado.
 */
export function getCitiesIndexSync(): Record<string, CityEntry[]> {
  return _data ?? {};
}

// ─── API sync compatível (FAIL-OPEN) ─────────────────────────────────────

/**
 * Retorna `true` se o nome normalizado é uma cidade conhecida.
 *
 * IMPORTANTE: enquanto o dataset não terminar de carregar, retorna `true`
 * (fail-open) para não esconder conteúdo legítimo. Dispara o preload em
 * background — chamadas subsequentes ficam estritas assim que o dataset
 * estiver pronto.
 */
export function isKnownCity(normName: string): boolean {
  if (!_data) {
    void preloadCitiesIndex();
    return true;
  }
  return normName in _data;
}

/**
 * Lookup estrito de cidade por nome normalizado (+ UF opcional).
 * Retorna `null` enquanto o dataset não foi carregado — dispara preload.
 */
export function lookupCity(
  normName: string,
  stateNorm?: string,
): CityEntry | null {
  if (!_data) {
    void preloadCitiesIndex();
    return null;
  }
  const arr = _data[normName];
  if (!arr) return null;
  if (arr.length === 1) return arr[0];
  if (stateNorm) {
    const upper = stateNorm.toUpperCase();
    const match = arr.find((e) => e.state === upper);
    if (match) return match;
  }
  return arr[0];
}

/** Versão async — garante que o dataset esteja carregado antes do lookup. */
export async function lookupCityAsync(
  normName: string,
  stateNorm?: string,
): Promise<CityEntry | null> {
  await preloadCitiesIndex();
  return lookupCity(normName, stateNorm);
}

/**
 * Compat: re-export do dataset como `CITIES_INDEX`. Retorna `{}` até o
 * preload terminar. Consumidores que iteram (ex.: build de autocomplete)
 * devem fazer `await preloadCitiesIndex()` antes.
 *
 * @deprecated Prefira `preloadCitiesIndex()` + uso direto do retorno.
 */
export const CITIES_INDEX = new Proxy(
  {} as Record<string, CityEntry[]>,
  {
    get(_t, key) {
      const data = _data ?? {};
      return (data as any)[key];
    },
    ownKeys() {
      return Reflect.ownKeys(_data ?? {});
    },
    getOwnPropertyDescriptor(_t, key) {
      const data = _data ?? {};
      return Object.getOwnPropertyDescriptor(data, key);
    },
    has(_t, key) {
      const data = _data ?? {};
      return key in data;
    },
  },
);
