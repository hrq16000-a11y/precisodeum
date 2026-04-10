/**
 * GEO Intelligence v5 — GeoEngine
 * 
 * Central module for geographic intent resolution.
 * Encapsulates ALL geo detection logic: city, metro, UF, sliding window.
 * The hook (useProviders) only consumes results.
 */

import { normalize } from './normalize';
import { getCityCoords, isRecognizedCity, CITY_COORDS } from './cityCoords';
import { resolveMetroRegion, isMemberOfMetro, type MetroRegion } from './metroRegions';
import { extractUFFromQuery, isUF, getUFCapital } from './ufIndex';
import { lookupCity } from './citiesIndex';
import { calculateDistanceKm, hasCoordinates } from './geoDistance';
import { trackGeoEvent } from './tracking';

// ─── Types ────────────────────────────────────────────────────────────

export type GeoIntentMode = 'strict' | 'balanced' | 'aggressive';

export type GeoResolutionStrategy =
  | 'metro'
  | 'cityIndex'
  | 'coordsLegacy'
  | 'ufOnly'
  | 'none';

export interface GeoEngineConfig {
  /** Controls aggressiveness of geo detection. Default: 'balanced' */
  intentMode: GeoIntentMode;
  /** Pipeline order. Default: ['metro','cityIndex','coordsLegacy','ufOnly','none'] */
  resolutionOrder: GeoResolutionStrategy[];
  /** Sliding window settings */
  slidingWindow: {
    enabled: boolean;
    maxWindowSize: number;
    minTokenLength: number;
  };
  /** Stopwords to strip before geo detection */
  stopwords: Set<string>;
}

export interface GeoIntent {
  /** Resolved city (normalized) */
  city: string;
  /** Resolved state (UF uppercase) */
  state: string;
  /** Coordinates of the resolved city */
  coords: { lat: number; lon: number } | null;
  /** Resolved metro region, if any */
  metro: MetroRegion | null;
  /** Dynamic radius for matching */
  radius: number;
  /** Core city name (stripped prefixes like "regiaometropolitanade") */
  coreCity: string;
  /** Confidence score 0–1 */
  confidence: number;
  /** Which strategy resolved this intent */
  resolvedBy: GeoResolutionStrategy;
  /** Geo tokens consumed from the query */
  geoTokens: string[];
  /** Remaining service/text tokens */
  serviceTokens: string[];
  /** Original query */
  originalQuery: string;
}

export interface GeoContext {
  cityNorm: string;
  stateNorm: string;
  coreCity: string;
  userCoords: { latitude: number; longitude: number } | null;
  metro: MetroRegion | null;
  radius: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const CAPITALS = new Set([
  'saopaulo','riodejaneiro','brasilia','salvador','fortaleza','belohorizonte',
  'manaus','curitiba','recife','portoalegre','belem','goiania',
  'saoluis','maceio','natal','teresina','campogrande','joaopessoa',
  'aracaju','cuiaba','florianopolis','palmas','macapa','boavista','riobranco',
  'vitoria','portovelho',
]);

const DEFAULT_STOPWORDS = new Set([
  'de','do','da','dos','das','em','no','na','nos','nas',
  'e','ou','para','por','com','regiao','grande',
  'região','metropolitana','interior','litoral',
]);

const DEFAULT_CONFIG: GeoEngineConfig = {
  intentMode: 'balanced',
  resolutionOrder: ['metro', 'cityIndex', 'coordsLegacy', 'ufOnly', 'none'],
  slidingWindow: {
    enabled: true,
    maxWindowSize: 6,
    minTokenLength: 3,
  },
  stopwords: DEFAULT_STOPWORDS,
};

// ─── Resolution cache ─────────────────────────────────────────────────

const _intentCache = new Map<string, GeoIntent>();
const CACHE_MAX = 500;

function cacheKey(query: string, city: string, state?: string): string {
  return `${query}|${city}|${state || ''}`;
}

// ─── Helper: core city extraction ─────────────────────────────────────

function extractCoreCity(cityNorm: string): string {
  if (cityNorm.startsWith('regiaometropolitanade')) {
    return cityNorm.slice('regiaometropolitanade'.length);
  }
  if (cityNorm.startsWith('regiaometropolitana')) {
    return cityNorm.slice('regiaometropolitana'.length);
  }
  if (cityNorm.startsWith('grande')) {
    return cityNorm.slice(6);
  }
  return cityNorm;
}

function isCapital(cityNorm: string): boolean {
  return CAPITALS.has(cityNorm);
}

function dynamicRadius(cityNorm: string, metroDetected: boolean): number {
  if (metroDetected) return 100;
  if (isCapital(cityNorm)) return 120;
  return 60;
}

// ─── Confidence scoring ───────────────────────────────────────────────

function computeConfidence(
  resolvedBy: GeoResolutionStrategy,
  hasCoords: boolean,
  hasMetro: boolean,
  hasUF: boolean,
  tokenCoverage: number, // 0-1: how much of query was geo
): number {
  const base: Record<GeoResolutionStrategy, number> = {
    metro: 0.95,
    cityIndex: 0.85,
    coordsLegacy: 0.80,
    ufOnly: 0.50,
    none: 0,
  };
  let score = base[resolvedBy];

  if (hasCoords) score = Math.min(1, score + 0.05);
  if (hasMetro) score = Math.min(1, score + 0.05);
  if (hasUF) score = Math.min(1, score + 0.05);

  // Penalize partial matches in sliding window
  if (tokenCoverage < 0.5 && resolvedBy === 'cityIndex') {
    score *= 0.9;
  }

  return Math.round(score * 100) / 100;
}

// ─── Core resolution strategies ───────────────────────────────────────

interface StrategyResult {
  city: string;
  state: string;
  coords: { lat: number; lon: number } | null;
  metro: MetroRegion | null;
  resolvedBy: GeoResolutionStrategy;
  geoTokenIndices?: [number, number]; // [start, end) for sliding window
}

function tryMetro(
  queryNorm: string,
  detectedUF?: string,
): StrategyResult | null {
  const metro = resolveMetroRegion(queryNorm, detectedUF);
  if (!metro) return null;
  const coords = getCityCoords(metro.pole);
  return {
    city: metro.pole,
    state: metro.state,
    coords,
    metro,
    resolvedBy: 'metro',
  };
}

function tryCityIndex(
  queryNorm: string,
  detectedUF?: string,
): StrategyResult | null {
  const coords = getCityCoords(queryNorm);
  if (coords) {
    const entry = lookupCity(queryNorm, detectedUF);
    return {
      city: queryNorm,
      state: entry?.state || (detectedUF?.toUpperCase() || ''),
      coords,
      metro: null,
      resolvedBy: 'cityIndex',
    };
  }
  if (isRecognizedCity(queryNorm)) {
    const entry = lookupCity(queryNorm, detectedUF);
    return {
      city: queryNorm,
      state: entry?.state || (detectedUF?.toUpperCase() || ''),
      coords: null,
      metro: null,
      resolvedBy: 'cityIndex',
    };
  }
  return null;
}

function tryCoordsLegacy(queryNorm: string): StrategyResult | null {
  if (queryNorm in CITY_COORDS) {
    const c = CITY_COORDS[queryNorm];
    return {
      city: queryNorm,
      state: c.state,
      coords: { lat: c.lat, lon: c.lon },
      metro: null,
      resolvedBy: 'coordsLegacy',
    };
  }
  return null;
}

function tryUFOnly(queryNorm: string): StrategyResult | null {
  if (isUF(queryNorm)) {
    const capital = getUFCapital(queryNorm);
    if (capital) {
      const coords = getCityCoords(capital);
      return {
        city: capital,
        state: queryNorm.toUpperCase(),
        coords,
        metro: null,
        resolvedBy: 'ufOnly',
      };
    }
  }
  return null;
}

// Strategy dispatcher
const STRATEGY_FN: Record<GeoResolutionStrategy, (q: string, uf?: string) => StrategyResult | null> = {
  metro: tryMetro,
  cityIndex: tryCityIndex,
  coordsLegacy: tryCoordsLegacy,
  ufOnly: (q) => tryUFOnly(q),
  none: () => null,
};

// ─── Sliding window ──────────────────────────────────────────────────

function slidingWindowResolve(
  rawTokens: string[],
  config: GeoEngineConfig,
  detectedUF?: string,
): { result: StrategyResult; start: number; end: number } | null {
  if (!config.slidingWindow.enabled) return null;

  const maxWin = Math.min(config.slidingWindow.maxWindowSize, rawTokens.length);
  let best: { result: StrategyResult; start: number; end: number } | null = null;

  for (let len = maxWin; len >= 1; len--) {
    for (let i = 0; i <= rawTokens.length - len; i++) {
      const candidate = rawTokens.slice(i, i + len).join(' ');
      const candidateNorm = normalize(candidate);

      if (candidateNorm.length < config.slidingWindow.minTokenLength) continue;

      // Try each strategy in order
      for (const strategy of config.resolutionOrder) {
        if (strategy === 'none') continue;
        const fn = STRATEGY_FN[strategy];
        const result = fn(candidateNorm, detectedUF);
        if (result) {
          // Metro is always highest priority — return immediately
          if (result.resolvedBy === 'metro') {
            return { result, start: i, end: i + len };
          }
          // For other strategies, prefer longest match
          if (!best || candidateNorm.length > normalize(rawTokens.slice(best.start, best.end).join(' ')).length) {
            best = { result, start: i, end: i + len };
          }
        }
      }
    }
    // If we found a metro match, it was already returned
    // If we found a city match at this length, stop looking at shorter
    if (best) break;
  }

  return best;
}

// ─── Main resolve function ────────────────────────────────────────────

function emptyIntent(query: string): GeoIntent {
  return {
    city: '',
    state: '',
    coords: null,
    metro: null,
    radius: 60,
    coreCity: '',
    confidence: 0,
    resolvedBy: 'none',
    geoTokens: [],
    serviceTokens: query.trim().split(/\s+/).filter(Boolean),
    originalQuery: query,
  };
}

export function resolve(
  query: string,
  externalCity?: string,
  externalState?: string,
  config: GeoEngineConfig = DEFAULT_CONFIG,
): GeoIntent {
  // Check cache
  const ck = cacheKey(query, externalCity || '', externalState);
  const cached = _intentCache.get(ck);
  if (cached) return cached;

  // Start with external city/state if provided (from URL params etc)
  let effectiveCity = externalCity ? normalize(externalCity) : '';
  let effectiveState = externalState || '';
  let effectiveCoords: { lat: number; lon: number } | null = null;
  let effectiveMetro: MetroRegion | null = null;
  let resolvedBy: GeoResolutionStrategy = 'none';
  let geoTokens: string[] = [];
  let serviceTokens: string[] = [];
  let confidence = 0;

  if (!query || !query.trim()) {
    // No query — use external city if available
    if (effectiveCity) {
      effectiveCoords = getCityCoords(effectiveCity);
      effectiveMetro = resolveMetroRegion(effectiveCity, effectiveState ? normalize(effectiveState) : undefined);
      resolvedBy = effectiveCoords ? 'coordsLegacy' : (isRecognizedCity(effectiveCity) ? 'cityIndex' : 'none');
      confidence = effectiveCoords ? 0.9 : 0.7;
    }
    const coreCity = extractCoreCity(effectiveCity);
    const intent: GeoIntent = {
      city: effectiveCity,
      state: effectiveState,
      coords: effectiveCoords,
      metro: effectiveMetro,
      radius: dynamicRadius(coreCity || effectiveCity, !!effectiveMetro),
      coreCity,
      confidence,
      resolvedBy,
      geoTokens: [],
      serviceTokens: [],
      originalQuery: query,
    };
    _cacheSet(ck, intent);
    return intent;
  }

  let workingQuery = query.trim();
  let detectedUF: string | undefined;

  // Step 0: Extract UF from query end
  const ufResult = extractUFFromQuery(workingQuery);
  if (ufResult) {
    detectedUF = ufResult.uf;
    workingQuery = ufResult.queryWithoutUF;
  }

  const queryNorm = normalize(workingQuery);

  // Step 1: Check if query is just a UF
  if (!queryNorm && detectedUF) {
    const capital = getUFCapital(detectedUF);
    if (capital) {
      const coords = getCityCoords(capital);
      const intent: GeoIntent = {
        city: capital,
        state: detectedUF.toUpperCase(),
        coords,
        metro: null,
        radius: dynamicRadius(capital, false),
        coreCity: capital,
        confidence: computeConfidence('ufOnly', !!coords, false, true, 1),
        resolvedBy: 'ufOnly',
        geoTokens: [detectedUF],
        serviceTokens: [],
        originalQuery: query,
      };
      _cacheSet(ck, intent);
      trackGeoEvent('geo_resolved_uf', { uf: detectedUF, city: capital });
      return intent;
    }
  }

  if (isUF(queryNorm) && !detectedUF) {
    const capital = getUFCapital(queryNorm);
    if (capital) {
      const coords = getCityCoords(capital);
      const intent: GeoIntent = {
        city: capital,
        state: queryNorm.toUpperCase(),
        coords,
        metro: null,
        radius: dynamicRadius(capital, false),
        coreCity: capital,
        confidence: computeConfidence('ufOnly', !!coords, false, false, 1),
        resolvedBy: 'ufOnly',
        geoTokens: [queryNorm],
        serviceTokens: [],
        originalQuery: query,
      };
      _cacheSet(ck, intent);
      trackGeoEvent('geo_resolved_uf', { uf: queryNorm, city: capital });
      return intent;
    }
  }

  // Step 2: Try full query against resolution pipeline
  for (const strategy of config.resolutionOrder) {
    if (strategy === 'none') continue;
    const fn = STRATEGY_FN[strategy];
    const result = fn(queryNorm, detectedUF);
    if (result) {
      const coreCity = extractCoreCity(result.city);
      const intent: GeoIntent = {
        city: result.city,
        state: result.state,
        coords: result.coords,
        metro: result.metro,
        radius: dynamicRadius(coreCity, !!result.metro),
        coreCity,
        confidence: computeConfidence(
          result.resolvedBy,
          !!result.coords,
          !!result.metro,
          !!detectedUF,
          1,
        ),
        resolvedBy: result.resolvedBy,
        geoTokens: workingQuery.split(/\s+/),
        serviceTokens: [],
        originalQuery: query,
      };
      _cacheSet(ck, intent);
      _trackResolution(intent);
      return intent;
    }
  }

  // Step 3: Sliding window — detect city/metro anywhere in query
  const rawTokens = workingQuery.trim().split(/\s+/);
  const swResult = slidingWindowResolve(rawTokens, config, detectedUF);

  if (swResult) {
    const { result, start, end } = swResult;
    const coreCity = extractCoreCity(result.city);
    const consumedTokens = rawTokens.slice(start, end);
    const remainingTokens = [
      ...rawTokens.slice(0, start),
      ...rawTokens.slice(end),
    ].filter(Boolean);

    const tokenCoverage = consumedTokens.length / rawTokens.length;

    // In strict mode, reject low-coverage sliding window matches
    if (config.intentMode === 'strict' && tokenCoverage < 0.3) {
      // Fall through to no-geo
    } else {
      const intent: GeoIntent = {
        city: result.city,
        state: result.state,
        coords: result.coords,
        metro: result.metro,
        radius: dynamicRadius(coreCity, !!result.metro),
        coreCity,
        confidence: computeConfidence(
          result.resolvedBy,
          !!result.coords,
          !!result.metro,
          !!detectedUF,
          tokenCoverage,
        ),
        resolvedBy: result.resolvedBy,
        geoTokens: consumedTokens,
        serviceTokens: remainingTokens,
        originalQuery: query,
      };
      _cacheSet(ck, intent);
      _trackResolution(intent);
      return intent;
    }
  }

  // Step 4: No geo detected — pure text query
  const fallback = emptyIntent(query);
  _cacheSet(ck, fallback);
  trackGeoEvent('geo_fallback_text_only', { query });
  return fallback;
}

// ─── GeoContext builder (for ranking) ─────────────────────────────────

export function buildGeoContext(
  intent: GeoIntent,
  userLat?: number | null,
  userLon?: number | null,
): GeoContext {
  const userCoords = hasCoordinates(userLat, userLon)
    ? { latitude: userLat!, longitude: userLon! }
    : null;

  return {
    cityNorm: intent.city,
    stateNorm: normalize(intent.state),
    coreCity: intent.coreCity,
    userCoords,
    metro: intent.metro,
    radius: intent.radius,
  };
}

// ─── Geo matching (unchanged core logic) ──────────────────────────────

export function matchesGeoContext(
  pCityNorm: string,
  pStateNorm: string,
  provCoords: { lat: number; lon: number } | null,
  ctx: GeoContext,
): boolean {
  if (!ctx.cityNorm && !ctx.stateNorm) return true;

  // Layer 1: Haversine with dynamic radius
  if (ctx.userCoords && provCoords) {
    const dist = calculateDistanceKm(
      ctx.userCoords,
      { latitude: provCoords.lat, longitude: provCoords.lon },
    );
    if (dist <= ctx.radius) return true;
  }

  // Layer 2: Metro region membership
  if (ctx.metro) {
    return isMemberOfMetro(pCityNorm, ctx.metro) || pCityNorm === ctx.coreCity;
  }

  // Layer 3: Fuzzy city name match
  if (ctx.cityNorm) {
    if (pCityNorm === ctx.cityNorm) return true;
    if (pCityNorm.includes(ctx.cityNorm) || ctx.cityNorm.includes(pCityNorm)) return true;
    if (ctx.coreCity !== ctx.cityNorm) {
      if (pCityNorm === ctx.coreCity) return true;
      if (pCityNorm.includes(ctx.coreCity) || ctx.coreCity.includes(pCityNorm)) return true;
    }
  }

  // Layer 4: Same state fallback
  if (ctx.stateNorm && pStateNorm === ctx.stateNorm) return true;

  return false;
}

export function geoScore(
  pCityNorm: string,
  pStateNorm: string,
  provCoords: { lat: number; lon: number } | null,
  ctx: GeoContext,
  intentConfidence: number = 1,
): number {
  let score = 0;

  if (pCityNorm === (ctx.coreCity || ctx.cityNorm)) score += 100;
  if (ctx.metro && isMemberOfMetro(pCityNorm, ctx.metro)) score += 70;

  if (ctx.userCoords && provCoords) {
    const d = calculateDistanceKm(
      ctx.userCoords,
      { latitude: provCoords.lat, longitude: provCoords.lon },
    );
    if (d <= 30) score += 50;
    else if (d <= 80) score += 30;
  }

  if (pStateNorm === ctx.stateNorm) score += 10;

  // Apply confidence modifier
  return Math.round(score * intentConfidence);
}

// ─── Provider coord resolution ────────────────────────────────────────

export function resolveProviderCoords(provider: {
  latitude: number | null;
  longitude: number | null;
  city: string;
}): { lat: number; lon: number } | null {
  if (hasCoordinates(provider.latitude, provider.longitude)) {
    return { lat: provider.latitude!, lon: provider.longitude! };
  }
  return getCityCoords(provider.city);
}

// ─── Cache management ─────────────────────────────────────────────────

function _cacheSet(key: string, intent: GeoIntent) {
  if (_intentCache.size >= CACHE_MAX) {
    // Evict oldest entries
    const firstKey = _intentCache.keys().next().value;
    if (firstKey) _intentCache.delete(firstKey);
  }
  _intentCache.set(key, intent);
}

export function clearGeoCache() {
  _intentCache.clear();
}

// ─── Telemetry ────────────────────────────────────────────────────────

function _trackResolution(intent: GeoIntent) {
  if (intent.metro) {
    trackGeoEvent('geo_resolved_metro', {
      metro: intent.metro.pole,
      query: intent.originalQuery,
      confidence: String(intent.confidence),
    });
  } else if (intent.city) {
    trackGeoEvent('geo_resolved_city', {
      city: intent.city,
      state: intent.state,
      resolvedBy: intent.resolvedBy,
      confidence: String(intent.confidence),
      query: intent.originalQuery,
    });
  } else {
    trackGeoEvent('geo_failed_resolution', {
      query: intent.originalQuery,
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────

export const GeoEngine = {
  resolve,
  buildGeoContext,
  matchesGeoContext,
  geoScore,
  resolveProviderCoords,
  clearCache: clearGeoCache,
  extractCoreCity,
  isCapital,
  dynamicRadius,
  DEFAULT_CONFIG,
} as const;

export default GeoEngine;
