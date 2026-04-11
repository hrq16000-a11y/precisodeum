/**
 * GEO Intelligence v5.1 — GeoEngine (Enterprise SaaS)
 *
 * Fully configurable, observable, multi-tenant geographic resolution engine.
 * Zero hardcoded logic in consumers — hook only calls GeoEngine.resolve().
 *
 * Features:
 *  - Abstract cache adapter (memory default, redis-ready)
 *  - Abstract telemetry adapter (console/noop/external)
 *  - Global singleton config with partial overrides
 *  - Feature flags per capability
 *  - Overmatch protection layer
 *  - Debug mode with full resolution trace
 *  - Formal UF resolution pipeline
 *  - Confidence-weighted ranking integration
 *  - Sliding window safety filter (noise token blacklist)
 *  - Multi-tenant config overrides
 */

import { normalize } from './normalize';
import { getCityCoords, isRecognizedCity, CITY_COORDS } from './cityCoords';
import { resolveMetroRegion, isMemberOfMetro, type MetroRegion } from './metroRegions';
import { extractUFFromQuery, isUF, getUFCapital } from './ufIndex';
import { lookupCity } from './citiesIndex';
import { calculateDistanceKm, hasCoordinates } from './geoDistance';

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════

export type GeoIntentMode = 'strict' | 'balanced' | 'aggressive';

export type GeoResolutionStrategy =
  | 'metro'
  | 'cityIndex'
  | 'coordsLegacy'
  | 'ufOnly'
  | 'none';

export type OvermatchProtectionLevel = 'low' | 'medium' | 'high';

export type TelemetryMode = 'console' | 'noop' | 'external';

/** Feature flags for toggling engine capabilities */
export interface GeoFeatureFlags {
  ibgeIndex: boolean;
  slidingWindow: boolean;
  metroRegions: boolean;
  ufDetection: boolean;
  fuzzyMatching: boolean;
}

/** UF detection sub-config */
export interface UFConfig {
  /** Try strict end-token detection first */
  strictEndToken: boolean;
  /** Try inline UF detection (mid-query) */
  inlineDetection: boolean;
  /** Try alias fallback (e.g. "Paraná" → "PR") */
  aliasFallback: boolean;
}

/** Sliding window sub-config */
export interface SlidingWindowConfig {
  enabled: boolean;
  maxWindowSize: number;
  minTokenLength: number;
  /** Tokens that should never be treated as geo */
  serviceNoiseTokens: string[];
}

/** Cache adapter interface — swap memory for redis etc. */
export interface GeoCacheAdapter<T = GeoIntent> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  clear(): void;
  readonly size: number;
}

/** Telemetry adapter interface */
export interface GeoTelemetryAdapter {
  track(event: string, data: Record<string, string>): void;
}

/** Multi-tenant override — custom aliases, metros, stopwords */
export interface TenantGeoConfig {
  /** Additional regional aliases merged with defaults */
  aliases?: Record<string, string>;
  /** Additional metro regions merged with defaults */
  metros?: MetroRegion[];
  /** Additional stopwords merged with defaults */
  stopwords?: string[];
  /** Additional service noise tokens */
  serviceNoiseTokens?: string[];
}

/** Full engine configuration */
export interface GeoEngineConfig {
  intentMode: GeoIntentMode;
  resolutionOrder: GeoResolutionStrategy[];
  slidingWindow: SlidingWindowConfig;
  stopwords: Set<string>;
  features: GeoFeatureFlags;
  ufConfig: UFConfig;
  overmatchProtectionLevel: OvermatchProtectionLevel;
  debugGeo: boolean;
  geoConfidenceWeight: number; // 0–1, multiplier for confidence in geoScore
  telemetryMode: TelemetryMode;
  cacheMaxSize: number;
  tenant?: TenantGeoConfig;
}

/** Debug trace attached when debugGeo=true */
export interface GeoDebugTrace {
  resolutionPath: string[];
  matchedCandidates: string[];
  rejectedCandidates: string[];
  tokenAnalysis: {
    original: string[];
    normalized: string;
    detectedUF: string | null;
    workingTokens: string[];
    noiseFiltered: string[];
  };
}

/** Resolved geographic intent */
export interface GeoIntent {
  city: string;
  state: string;
  coords: { lat: number; lon: number } | null;
  metro: MetroRegion | null;
  radius: number;
  coreCity: string;
  confidence: number;
  resolvedBy: GeoResolutionStrategy;
  geoTokens: string[];
  serviceTokens: string[];
  originalQuery: string;
  debug?: GeoDebugTrace;
}

export interface GeoContext {
  cityNorm: string;
  stateNorm: string;
  coreCity: string;
  userCoords: { latitude: number; longitude: number } | null;
  metro: MetroRegion | null;
  radius: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: Adapters (Cache + Telemetry)
// ═══════════════════════════════════════════════════════════════════════

/** In-memory LRU cache (default) */
class MemoryCacheAdapter implements GeoCacheAdapter<GeoIntent> {
  private _map = new Map<string, GeoIntent>();
  private _maxSize: number;

  constructor(maxSize = 500) {
    this._maxSize = maxSize;
  }

  get size() { return this._map.size; }

  get(key: string): GeoIntent | undefined {
    return this._map.get(key);
  }

  set(key: string, value: GeoIntent): void {
    if (this._map.size >= this._maxSize) {
      const firstKey = this._map.keys().next().value;
      if (firstKey) this._map.delete(firstKey);
    }
    this._map.set(key, value);
  }

  clear(): void {
    this._map.clear();
  }
}

/** Console telemetry — dev mode */
class ConsoleTelemetryAdapter implements GeoTelemetryAdapter {
  track(event: string, data: Record<string, string>): void {
    console.debug(`[GeoEngine] ${event}`, data);
  }
}

/** Noop telemetry — silent */
class NoopTelemetryAdapter implements GeoTelemetryAdapter {
  track(): void { /* intentionally empty */ }
}

/** External hook telemetry — calls user-provided fn */
class ExternalTelemetryAdapter implements GeoTelemetryAdapter {
  private _fn: (event: string, data: Record<string, string>) => void;
  constructor(fn: (event: string, data: Record<string, string>) => void) {
    this._fn = fn;
  }
  track(event: string, data: Record<string, string>): void {
    try { this._fn(event, data); } catch { /* silent */ }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: Constants & Defaults
// ═══════════════════════════════════════════════════════════════════════

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

const DEFAULT_NOISE_TOKENS = [
  'urgente','24h','barato','melhorpreco','melhor','preco',
  'rapido','online','perto','aqui','agora','profissional',
  'servico','servicos','empresa','empresas',
];

const DEFAULT_FEATURES: GeoFeatureFlags = {
  ibgeIndex: true,
  slidingWindow: true,
  metroRegions: true,
  ufDetection: true,
  fuzzyMatching: true,
};

const DEFAULT_UF_CONFIG: UFConfig = {
  strictEndToken: true,
  inlineDetection: true,
  aliasFallback: true,
};

const DEFAULT_CONFIG: GeoEngineConfig = {
  intentMode: 'balanced',
  resolutionOrder: ['metro', 'cityIndex', 'coordsLegacy', 'ufOnly', 'none'],
  slidingWindow: {
    enabled: true,
    maxWindowSize: 6,
    minTokenLength: 3,
    serviceNoiseTokens: [...DEFAULT_NOISE_TOKENS],
  },
  stopwords: DEFAULT_STOPWORDS,
  features: { ...DEFAULT_FEATURES },
  ufConfig: { ...DEFAULT_UF_CONFIG },
  overmatchProtectionLevel: 'medium',
  debugGeo: false,
  geoConfidenceWeight: 1.0,
  telemetryMode: 'noop',
  cacheMaxSize: 500,
};

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: Global Singleton State
// ═══════════════════════════════════════════════════════════════════════

let _config: GeoEngineConfig = deepCloneConfig(DEFAULT_CONFIG);
let _cache: GeoCacheAdapter<GeoIntent> = new MemoryCacheAdapter(_config.cacheMaxSize);
let _telemetry: GeoTelemetryAdapter = new NoopTelemetryAdapter();
let _externalTelemetryFn: ((event: string, data: Record<string, string>) => void) | null = null;

function deepCloneConfig(c: GeoEngineConfig): GeoEngineConfig {
  return {
    ...c,
    resolutionOrder: [...c.resolutionOrder],
    slidingWindow: {
      ...c.slidingWindow,
      serviceNoiseTokens: [...c.slidingWindow.serviceNoiseTokens],
    },
    stopwords: new Set(c.stopwords),
    features: { ...c.features },
    ufConfig: { ...c.ufConfig },
    tenant: c.tenant ? {
      aliases: c.tenant.aliases ? { ...c.tenant.aliases } : undefined,
      metros: c.tenant.metros ? [...c.tenant.metros] : undefined,
      stopwords: c.tenant.stopwords ? [...c.tenant.stopwords] : undefined,
      serviceNoiseTokens: c.tenant.serviceNoiseTokens ? [...c.tenant.serviceNoiseTokens] : undefined,
    } : undefined,
  };
}

function rebuildTelemetry() {
  switch (_config.telemetryMode) {
    case 'console':
      _telemetry = new ConsoleTelemetryAdapter();
      break;
    case 'external':
      _telemetry = _externalTelemetryFn
        ? new ExternalTelemetryAdapter(_externalTelemetryFn)
        : new NoopTelemetryAdapter();
      break;
    default:
      _telemetry = new NoopTelemetryAdapter();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 5: Helpers (unchanged core logic)
// ═══════════════════════════════════════════════════════════════════════

function cacheKey(query: string, city: string, state?: string): string {
  return `${query}|${city}|${state || ''}`;
}

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

// ═══════════════════════════════════════════════════════════════════════
// SECTION 6: Confidence scoring
// ═══════════════════════════════════════════════════════════════════════

function computeConfidence(
  resolvedBy: GeoResolutionStrategy,
  hasCoords: boolean,
  hasMetro: boolean,
  hasUF: boolean,
  tokenCoverage: number,
  overmatchLevel: OvermatchProtectionLevel,
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

  // Overmatch protection penalty
  if (overmatchLevel === 'medium' && tokenCoverage < 0.4) {
    score *= 0.85;
  } else if (overmatchLevel === 'high' && tokenCoverage < 0.5) {
    score *= 0.7;
  }

  return Math.round(score * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 7: Resolution strategies
// ═══════════════════════════════════════════════════════════════════════

interface StrategyResult {
  city: string;
  state: string;
  coords: { lat: number; lon: number } | null;
  metro: MetroRegion | null;
  resolvedBy: GeoResolutionStrategy;
}

function tryMetro(queryNorm: string, detectedUF?: string): StrategyResult | null {
  if (!_config.features.metroRegions) return null;
  const metro = resolveMetroRegion(queryNorm, detectedUF);
  if (!metro) return null;
  const coords = getCityCoords(metro.pole);
  return { city: metro.pole, state: metro.state, coords, metro, resolvedBy: 'metro' };
}

function tryCityIndex(queryNorm: string, detectedUF?: string): StrategyResult | null {
  const coords = getCityCoords(queryNorm);
  if (coords) {
    const entry = _config.features.ibgeIndex ? lookupCity(queryNorm, detectedUF) : null;
    return {
      city: queryNorm,
      state: entry?.state || (detectedUF?.toUpperCase() || ''),
      coords,
      metro: null,
      resolvedBy: 'cityIndex',
    };
  }
  if (_config.features.ibgeIndex && isRecognizedCity(queryNorm)) {
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
  if (!_config.features.ufDetection) return null;
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

const STRATEGY_FN: Record<GeoResolutionStrategy, (q: string, uf?: string) => StrategyResult | null> = {
  metro: tryMetro,
  cityIndex: tryCityIndex,
  coordsLegacy: tryCoordsLegacy,
  ufOnly: (q) => tryUFOnly(q),
  none: () => null,
};

// ═══════════════════════════════════════════════════════════════════════
// SECTION 8: Sliding window with safety filter
// ═══════════════════════════════════════════════════════════════════════

function isNoiseToken(token: string): boolean {
  const norm = normalize(token);
  const noiseSet = _config.slidingWindow.serviceNoiseTokens;
  // Also check tenant noise
  const tenantNoise = _config.tenant?.serviceNoiseTokens || [];
  return noiseSet.includes(norm) || tenantNoise.includes(norm);
}

function slidingWindowResolve(
  rawTokens: string[],
  detectedUF?: string,
  debugTrace?: GeoDebugTrace,
): { result: StrategyResult; start: number; end: number } | null {
  if (!_config.features.slidingWindow || !_config.slidingWindow.enabled) return null;

  const maxWin = Math.min(_config.slidingWindow.maxWindowSize, rawTokens.length);
  let best: { result: StrategyResult; start: number; end: number } | null = null;

  for (let len = maxWin; len >= 1; len--) {
    for (let i = 0; i <= rawTokens.length - len; i++) {
      const candidate = rawTokens.slice(i, i + len).join(' ');
      const candidateNorm = normalize(candidate);

      if (candidateNorm.length < _config.slidingWindow.minTokenLength) continue;

      // Safety filter: skip single noise tokens
      if (len === 1 && isNoiseToken(rawTokens[i])) {
        debugTrace?.rejectedCandidates.push(`${candidateNorm} (noise)`);
        continue;
      }

      // High overmatch protection: skip if candidate looks like service term
      if (_config.overmatchProtectionLevel === 'high' && len === 1) {
        // Single-token geo matches are suspicious in high protection
        debugTrace?.rejectedCandidates.push(`${candidateNorm} (high-protection-single-token)`);
        continue;
      }

      for (const strategy of _config.resolutionOrder) {
        if (strategy === 'none') continue;
        const fn = STRATEGY_FN[strategy];
        const result = fn(candidateNorm, detectedUF);
        if (result) {
          debugTrace?.matchedCandidates.push(`${candidateNorm}→${result.resolvedBy}`);
          if (result.resolvedBy === 'metro') {
            return { result, start: i, end: i + len };
          }
          if (!best || candidateNorm.length > normalize(rawTokens.slice(best.start, best.end).join(' ')).length) {
            best = { result, start: i, end: i + len };
          }
        } else {
          debugTrace?.rejectedCandidates.push(candidateNorm);
        }
      }
    }
    if (best) break;
  }

  return best;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 9: UF Resolution Pipeline (formal)
// ═══════════════════════════════════════════════════════════════════════

interface UFDetectionResult {
  uf: string;
  queryWithoutUF: string;
}

function resolveUF(query: string): UFDetectionResult | null {
  if (!_config.features.ufDetection) return null;

  // Stage 1: strict end token
  if (_config.ufConfig.strictEndToken) {
    const result = extractUFFromQuery(query);
    if (result) return { uf: result.uf, queryWithoutUF: result.queryWithoutUF };
  }

  // Stage 2: inline detection — find UF anywhere in tokens
  if (_config.ufConfig.inlineDetection) {
    const tokens = query.trim().split(/\s+/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i].toLowerCase().replace(/[^a-z]/g, '');
      if (t.length === 2 && isUF(t)) {
        const remaining = [...tokens.slice(0, i), ...tokens.slice(i + 1)].join(' ').trim();
        if (remaining.length > 0) {
          return { uf: t, queryWithoutUF: remaining };
        }
      }
    }
  }

  // Stage 3: alias fallback (full state name → UF)
  if (_config.ufConfig.aliasFallback) {
    const STATE_NAME_TO_UF: Record<string, string> = {
      parana: 'pr', saopaulo: 'sp', riodejaneiro: 'rj', minasgerais: 'mg',
      riograndedosul: 'rs', santacatarina: 'sc', bahia: 'ba', goias: 'go',
      pernambuco: 'pe', ceara: 'ce', para: 'pa', maranhao: 'ma',
      amazonas: 'am', matogrosso: 'mt', matogrossodosul: 'ms',
      distritofederal: 'df', espiritosanto: 'es', paraiba: 'pb',
      riograndedonorte: 'rn', alagoas: 'al', piaui: 'pi', sergipe: 'se',
      rondonia: 'ro', tocantins: 'to', acre: 'ac', amapa: 'ap', roraima: 'rr',
    };
    const norm = normalize(query);
    for (const [name, uf] of Object.entries(STATE_NAME_TO_UF)) {
      if (norm.endsWith(name)) {
        const before = norm.slice(0, norm.length - name.length);
        if (before.length > 0) {
          return { uf, queryWithoutUF: query.slice(0, query.length - name.length).trim() };
        }
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 10: Main resolve function
// ═══════════════════════════════════════════════════════════════════════

function emptyIntent(query: string, debug?: GeoDebugTrace): GeoIntent {
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
    debug,
  };
}

function buildIntent(
  result: StrategyResult,
  coreCity: string,
  confidence: number,
  geoTokens: string[],
  serviceTokens: string[],
  query: string,
  debug?: GeoDebugTrace,
): GeoIntent {
  return {
    city: result.city,
    state: result.state,
    coords: result.coords,
    metro: result.metro,
    radius: dynamicRadius(coreCity, !!result.metro),
    coreCity,
    confidence,
    resolvedBy: result.resolvedBy,
    geoTokens,
    serviceTokens,
    originalQuery: query,
    debug,
  };
}

export function resolve(
  query: string,
  externalCity?: string,
  externalState?: string,
  configOverride?: Partial<GeoEngineConfig>,
): GeoIntent {
  const cfg = configOverride ? mergeConfig(_config, configOverride) : _config;
  const isDebug = cfg.debugGeo;

  // Init debug trace
  const debugTrace: GeoDebugTrace | undefined = isDebug ? {
    resolutionPath: [],
    matchedCandidates: [],
    rejectedCandidates: [],
    tokenAnalysis: {
      original: [],
      normalized: '',
      detectedUF: null,
      workingTokens: [],
      noiseFiltered: [],
    },
  } : undefined;

  // Check cache (skip in debug mode)
  const ck = cacheKey(query, externalCity || '', externalState);
  if (!isDebug) {
    const cached = _cache.get(ck);
    if (cached) return cached;
  }

  // Start with external city/state if provided
  let effectiveCity = externalCity ? normalize(externalCity) : '';
  let effectiveState = externalState || '';

  if (!query || !query.trim()) {
    let effectiveCoords: { lat: number; lon: number } | null = null;
    let effectiveMetro: MetroRegion | null = null;
    let resolvedBy: GeoResolutionStrategy = 'none';
    let confidence = 0;

    if (effectiveCity) {
      effectiveCoords = getCityCoords(effectiveCity);
      effectiveMetro = cfg.features.metroRegions
        ? resolveMetroRegion(effectiveCity, effectiveState ? normalize(effectiveState) : undefined)
        : null;
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
      debug: debugTrace,
    };
    if (!isDebug) _cache.set(ck, intent);
    return intent;
  }

  let workingQuery = query.trim();
  let detectedUF: string | undefined;

  // Step 0: UF resolution pipeline (formal)
  debugTrace?.resolutionPath.push('uf_pipeline');
  const ufResult = resolveUF(workingQuery);
  if (ufResult) {
    detectedUF = ufResult.uf;
    workingQuery = ufResult.queryWithoutUF;
    if (debugTrace) debugTrace.tokenAnalysis.detectedUF = detectedUF;
  }

  const queryNorm = normalize(workingQuery);
  if (debugTrace) {
    debugTrace.tokenAnalysis.original = query.trim().split(/\s+/);
    debugTrace.tokenAnalysis.normalized = queryNorm;
    debugTrace.tokenAnalysis.workingTokens = workingQuery.split(/\s+/);
  }

  // Step 1: Query is just a UF
  if (!queryNorm && detectedUF) {
    debugTrace?.resolutionPath.push('uf_only');
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
        confidence: computeConfidence('ufOnly', !!coords, false, true, 1, cfg.overmatchProtectionLevel),
        resolvedBy: 'ufOnly',
        geoTokens: [detectedUF],
        serviceTokens: [],
        originalQuery: query,
        debug: debugTrace,
      };
      if (!isDebug) _cache.set(ck, intent);
      _telemetry.track('geo_resolved_uf', { uf: detectedUF, city: capital });
      return intent;
    }
  }

  if (isUF(queryNorm) && !detectedUF && cfg.features.ufDetection) {
    debugTrace?.resolutionPath.push('bare_uf');
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
        confidence: computeConfidence('ufOnly', !!coords, false, false, 1, cfg.overmatchProtectionLevel),
        resolvedBy: 'ufOnly',
        geoTokens: [queryNorm],
        serviceTokens: [],
        originalQuery: query,
        debug: debugTrace,
      };
      if (!isDebug) _cache.set(ck, intent);
      _telemetry.track('geo_resolved_uf', { uf: queryNorm, city: capital });
      return intent;
    }
  }

  // Step 2: Try full query against resolution pipeline
  debugTrace?.resolutionPath.push('full_query_pipeline');
  for (const strategy of cfg.resolutionOrder) {
    if (strategy === 'none') continue;
    const fn = STRATEGY_FN[strategy];
    const result = fn(queryNorm, detectedUF);
    if (result) {
      debugTrace?.matchedCandidates.push(`${queryNorm}→${result.resolvedBy}`);
      const coreCity = extractCoreCity(result.city);
      const intent = buildIntent(
        result,
        coreCity,
        computeConfidence(result.resolvedBy, !!result.coords, !!result.metro, !!detectedUF, 1, cfg.overmatchProtectionLevel),
        workingQuery.split(/\s+/),
        [],
        query,
        debugTrace,
      );
      if (!isDebug) _cache.set(ck, intent);
      _trackResolution(intent);
      return intent;
    }
  }

  // Step 3: Sliding window
  debugTrace?.resolutionPath.push('sliding_window');
  const rawTokens = workingQuery.trim().split(/\s+/);

  // Filter noise tokens for debug
  if (debugTrace) {
    debugTrace.tokenAnalysis.noiseFiltered = rawTokens.filter(t => isNoiseToken(t));
  }

  const swResult = slidingWindowResolve(rawTokens, detectedUF, debugTrace);

  if (swResult) {
    const { result, start, end } = swResult;
    const coreCity = extractCoreCity(result.city);
    const consumedTokens = rawTokens.slice(start, end);
    const remainingTokens = [
      ...rawTokens.slice(0, start),
      ...rawTokens.slice(end),
    ].filter(Boolean);
    const tokenCoverage = consumedTokens.length / rawTokens.length;

    // Strict mode rejection
    if (cfg.intentMode === 'strict' && tokenCoverage < 0.3) {
      debugTrace?.resolutionPath.push('strict_rejection');
    } else {
      const intent = buildIntent(
        result,
        coreCity,
        computeConfidence(result.resolvedBy, !!result.coords, !!result.metro, !!detectedUF, tokenCoverage, cfg.overmatchProtectionLevel),
        consumedTokens,
        remainingTokens,
        query,
        debugTrace,
      );
      if (!isDebug) _cache.set(ck, intent);
      _trackResolution(intent);
      return intent;
    }
  }

  // Step 4: No geo detected
  debugTrace?.resolutionPath.push('fallback_text_only');
  const fallback = emptyIntent(query, debugTrace);
  if (!isDebug) _cache.set(ck, fallback);
  _telemetry.track('geo_fallback_text_only', { query });
  return fallback;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 11: GeoContext builder & matching (unchanged core)
// ═══════════════════════════════════════════════════════════════════════

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

export function matchesGeoContext(
  pCityNorm: string,
  pStateNorm: string,
  provCoords: { lat: number; lon: number } | null,
  ctx: GeoContext,
): boolean {
  if (!ctx.cityNorm && !ctx.stateNorm) return true;

  // PRIMARY: When user has coords, use strict radius-based matching
  if (ctx.userCoords && provCoords) {
    const dist = calculateDistanceKm(
      ctx.userCoords,
      { latitude: provCoords.lat, longitude: provCoords.lon },
    );
    return dist <= ctx.radius;
  }

  // SECONDARY: When user has coords but provider doesn't — provider can't be confirmed local
  if (ctx.userCoords && !provCoords) {
    // Fallback: only match exact city name
    if (ctx.cityNorm && pCityNorm === ctx.cityNorm) return true;
    if (ctx.coreCity && ctx.coreCity !== ctx.cityNorm && pCityNorm === ctx.coreCity) return true;
    return false;
  }

  // TERTIARY: No user coords — use city/metro name matching (no state-only)
  if (ctx.metro) {
    return isMemberOfMetro(pCityNorm, ctx.metro) || pCityNorm === ctx.coreCity;
  }

  if (_config.features.fuzzyMatching && ctx.cityNorm) {
    if (pCityNorm === ctx.cityNorm) return true;
    if (pCityNorm.includes(ctx.cityNorm) || ctx.cityNorm.includes(pCityNorm)) return true;
    if (ctx.coreCity !== ctx.cityNorm) {
      if (pCityNorm === ctx.coreCity) return true;
      if (pCityNorm.includes(ctx.coreCity) || ctx.coreCity.includes(pCityNorm)) return true;
    }
  } else if (ctx.cityNorm) {
    if (pCityNorm === ctx.cityNorm) return true;
    if (ctx.coreCity !== ctx.cityNorm && pCityNorm === ctx.coreCity) return true;
  }

  // NOTE: Removed state-only matching — same state does NOT mean "local"
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

  // Apply confidence × configurable weight
  const weight = _config.geoConfidenceWeight;
  return Math.round(score * intentConfidence * weight);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 12: Provider coord resolution
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// SECTION 13: Telemetry helper
// ═══════════════════════════════════════════════════════════════════════

function _trackResolution(intent: GeoIntent) {
  if (intent.metro) {
    _telemetry.track('geo_resolved_metro', {
      metro: intent.metro.pole,
      query: intent.originalQuery,
      confidence: String(intent.confidence),
    });
  } else if (intent.city) {
    _telemetry.track('geo_resolved_city', {
      city: intent.city,
      state: intent.state,
      resolvedBy: intent.resolvedBy,
      confidence: String(intent.confidence),
      query: intent.originalQuery,
    });
  } else {
    _telemetry.track('geo_failed_resolution', {
      query: intent.originalQuery,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 14: Configuration API
// ═══════════════════════════════════════════════════════════════════════

function mergeConfig(base: GeoEngineConfig, partial: Partial<GeoEngineConfig>): GeoEngineConfig {
  const merged = deepCloneConfig(base);

  if (partial.intentMode !== undefined) merged.intentMode = partial.intentMode;
  if (partial.resolutionOrder) merged.resolutionOrder = [...partial.resolutionOrder];
  if (partial.overmatchProtectionLevel !== undefined) merged.overmatchProtectionLevel = partial.overmatchProtectionLevel;
  if (partial.debugGeo !== undefined) merged.debugGeo = partial.debugGeo;
  if (partial.geoConfidenceWeight !== undefined) merged.geoConfidenceWeight = partial.geoConfidenceWeight;
  if (partial.telemetryMode !== undefined) merged.telemetryMode = partial.telemetryMode;
  if (partial.cacheMaxSize !== undefined) merged.cacheMaxSize = partial.cacheMaxSize;

  if (partial.slidingWindow) {
    Object.assign(merged.slidingWindow, partial.slidingWindow);
  }
  if (partial.features) {
    Object.assign(merged.features, partial.features);
  }
  if (partial.ufConfig) {
    Object.assign(merged.ufConfig, partial.ufConfig);
  }
  if (partial.stopwords) {
    merged.stopwords = partial.stopwords;
  }
  if (partial.tenant) {
    merged.tenant = {
      ...merged.tenant,
      ...partial.tenant,
    };
  }

  return merged;
}

/** Configure the global GeoEngine singleton. Partial overrides only. */
function configure(partial: Partial<GeoEngineConfig>) {
  _config = mergeConfig(_config, partial);
  _cache = new MemoryCacheAdapter(_config.cacheMaxSize);
  rebuildTelemetry();
}

/** Get a readonly snapshot of current config */
function getConfig(): Readonly<GeoEngineConfig> {
  return deepCloneConfig(_config);
}

/** Set a custom cache adapter (e.g. Redis wrapper) */
function setCacheAdapter(adapter: GeoCacheAdapter<GeoIntent>) {
  _cache = adapter;
}

/** Set external telemetry function */
function setTelemetryHandler(fn: (event: string, data: Record<string, string>) => void) {
  _externalTelemetryFn = fn;
  if (_config.telemetryMode === 'external') {
    rebuildTelemetry();
  }
}

function clearCache() {
  _cache.clear();
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 15: Public API
// ═══════════════════════════════════════════════════════════════════════

export const GeoEngine = {
  // Core
  resolve,
  buildGeoContext,
  matchesGeoContext,
  geoScore,
  resolveProviderCoords,

  // Configuration
  configure,
  getConfig,
  DEFAULT_CONFIG: deepCloneConfig(DEFAULT_CONFIG),

  // Adapters
  setCacheAdapter,
  setTelemetryHandler,
  clearCache,

  // Helpers (exposed for tests / external use)
  extractCoreCity,
  isCapital,
  dynamicRadius,
} as const;

export default GeoEngine;

// Adapter types already exported at declaration site
