/**
 * Search Intelligence Layer v1 (SIL)
 *
 * Orchestration layer above GeoEngine v5.1.
 * GeoEngine is the single source of truth for geographic resolution.
 * SIL handles: intent detection, strategy routing, combined scoring, fallback.
 *
 * Pipeline: Query → SIL.analyze() → GeoEngine.resolve() → Strategy → Ranked Results
 */

import GeoEngine from './geoEngine';
import type { GeoIntent, GeoContext } from './geoEngine';
import { normalize } from './normalize';
import { trackEvent } from './tracking';
import GovernanceEngine from './governanceEngine';

// ═══════════════════════════════════════════════════════════════════════
// SECTION 1: Types
// ═══════════════════════════════════════════════════════════════════════

export type SearchIntent = 'GEO_ONLY' | 'SERVICE_ONLY' | 'HYBRID';

export type FallbackMode = 'geo' | 'service' | 'both';

export interface SILConfig {
  geoWeight: number;
  serviceWeight: number;
  enableGeoFiltering: boolean;
  enableHybridBoost: boolean;
  fallbackMode: FallbackMode;
  /** Confidence threshold below which SIL falls back to SERVICE_ONLY */
  confidenceThreshold: number;
}

export interface SILResult {
  intent: SearchIntent;
  geoIntent: GeoIntent;
  geoContext: GeoContext;
  serviceQuery: string;
  /** Whether fallback was triggered due to low confidence */
  fallbackTriggered: boolean;
}

export interface ScoredItem {
  geoScore: number;
  relevanceScore: number;
  finalScore: number;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 2: Default Config + Singleton
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: SILConfig = {
  geoWeight: 0.6,
  serviceWeight: 0.4,
  enableGeoFiltering: true,
  enableHybridBoost: true,
  fallbackMode: 'both',
  confidenceThreshold: 0.4,
};

let _config: SILConfig = { ...DEFAULT_CONFIG };
let _governanceLoaded = false;

/**
 * Load SIL config overrides from Governance Engine (non-blocking).
 * Falls back to DEFAULT_CONFIG if governance is unavailable.
 */
async function loadGovernanceConfig(): Promise<void> {
  if (_governanceLoaded) return;
  try {
    const overrides = await GovernanceEngine.getRuleValue<Partial<SILConfig>>(
      'sil', 'config_overrides', {}
    );
    if (overrides && typeof overrides === 'object') {
      _config = { ...DEFAULT_CONFIG, ...overrides };
      _governanceLoaded = true;
    }
  } catch {
    // Governance unavailable — continue with defaults
  }
}

// Fire-and-forget governance load on module init
loadGovernanceConfig();

// ═══════════════════════════════════════════════════════════════════════
// SECTION 3: Telemetry (delegates to tracking.ts)
// ═══════════════════════════════════════════════════════════════════════

function silTrack(event: string, data: Record<string, string>) {
  trackEvent({ event: event as any, extra: data });
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 4: Intent Detection
// ═══════════════════════════════════════════════════════════════════════

function detectIntent(geoIntent: GeoIntent): SearchIntent {
  const hasGeo = geoIntent.resolvedBy !== 'none' && geoIntent.confidence > 0;
  const hasService = geoIntent.serviceTokens.length > 0 &&
    geoIntent.serviceTokens.some(t => t.trim().length > 0);

  if (hasGeo && hasService) return 'HYBRID';
  if (hasGeo) return 'GEO_ONLY';
  return 'SERVICE_ONLY';
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 5: Core SIL API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Analyze a search query and produce a SILResult with intent, geo context,
 * and the cleaned service query.
 */
function analyze(
  query: string,
  city?: string,
  state?: string,
  userLat?: number | null,
  userLon?: number | null,
): SILResult {
  // 1. Delegate geo resolution entirely to GeoEngine
  const geoIntent = GeoEngine.resolve(query, city, state);

  // 2. Detect intent
  let intent = detectIntent(geoIntent);

  // 3. Check confidence fallback
  let fallbackTriggered = false;
  if (intent !== 'SERVICE_ONLY' && geoIntent.confidence < _config.confidenceThreshold) {
    fallbackTriggered = true;
    intent = 'SERVICE_ONLY';
    silTrack('sil_fallback_triggered', {
      query,
      confidence: String(geoIntent.confidence),
      originalIntent: detectIntent(geoIntent),
    });
  }

  // 4. Build geo context from resolved intent
  const effectiveLat = geoIntent.coords?.lat ?? userLat;
  const effectiveLon = geoIntent.coords?.lon ?? userLon;
  const geoContext = GeoEngine.buildGeoContext(geoIntent, effectiveLat, effectiveLon);

  // 5. Extract service query from service tokens
  const serviceQuery = geoIntent.serviceTokens.join(' ').trim();

  // 6. Telemetry
  silTrack('sil_intent_detected', { intent, query });
  silTrack('sil_route_selected', {
    intent,
    geoConfidence: String(geoIntent.confidence),
    resolvedBy: geoIntent.resolvedBy,
  });
  if (intent !== 'SERVICE_ONLY') {
    silTrack('sil_geo_used', {
      city: geoIntent.city,
      state: geoIntent.state,
      resolvedBy: geoIntent.resolvedBy,
    });
  }

  return {
    intent,
    geoIntent,
    geoContext,
    serviceQuery,
    fallbackTriggered,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 6: Scoring
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute the combined final score for a provider given geo and relevance scores.
 */
function computeFinalScore(
  geoScore: number,
  relevanceScore: number,
  intent: SearchIntent,
): ScoredItem {
  let gW = _config.geoWeight;
  let sW = _config.serviceWeight;

  // Adjust weights based on intent
  if (intent === 'GEO_ONLY') {
    gW = 0.9;
    sW = 0.1;
  } else if (intent === 'SERVICE_ONLY') {
    gW = 0;
    sW = 1;
  } else if (intent === 'HYBRID' && _config.enableHybridBoost) {
    // Keep configured weights, slight boost to both
    gW = _config.geoWeight;
    sW = _config.serviceWeight;
  }

  const finalScore = (geoScore * gW) + (relevanceScore * sW);

  return { geoScore, relevanceScore, finalScore };
}

/**
 * Compute text relevance score for a provider against service terms.
 * Returns 0–1 based on how many terms match.
 */
function computeRelevanceScore(
  provider: { name: string; category: string; description: string; businessName?: string },
  serviceQuery: string,
): number {
  if (!serviceQuery) return 0.5; // neutral when no service query

  const terms = serviceQuery.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0.5;

  const searchable = [
    provider.name,
    provider.category,
    provider.description,
    provider.businessName || '',
  ].join(' ').toLowerCase();

  let matched = 0;
  for (const term of terms) {
    if (searchable.includes(term)) matched++;
  }

  return terms.length > 0 ? matched / terms.length : 0.5;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 7: Provider Filtering (delegates geo checks to GeoEngine)
// ═══════════════════════════════════════════════════════════════════════

interface ProviderGeoData {
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Check if a provider matches the geo context using GeoEngine.
 */
function matchesGeo(provider: ProviderGeoData, ctx: GeoContext): boolean {
  const pCityNorm = normalize(provider.city);
  const pStateNorm = normalize(provider.state);
  const provCoords = (provider.latitude != null && provider.longitude != null)
    ? { lat: provider.latitude, lon: provider.longitude }
    : null;
  return GeoEngine.matchesGeoContext(pCityNorm, pStateNorm, provCoords, ctx);
}

/**
 * Compute geo score for a provider using GeoEngine.
 */
function providerGeoScore(
  provider: ProviderGeoData,
  ctx: GeoContext,
  confidence: number,
): number {
  const pCityNorm = normalize(provider.city);
  const pStateNorm = normalize(provider.state);
  const provCoords = (provider.latitude != null && provider.longitude != null)
    ? { lat: provider.latitude, lon: provider.longitude }
    : null;
  return GeoEngine.geoScore(pCityNorm, pStateNorm, provCoords, ctx, confidence);
}

// ═══════════════════════════════════════════════════════════════════════
// SECTION 8: Public API (Singleton)
// ═══════════════════════════════════════════════════════════════════════

const SearchIntelligence = {
  /** Configure SIL with partial overrides */
  configure(partial: Partial<SILConfig>) {
    _config = { ..._config, ...partial };
  },

  /** Get current config (read-only copy) */
  getConfig(): Readonly<SILConfig> {
    return { ..._config };
  },

  /** Reset to defaults */
  reset() {
    _config = { ...DEFAULT_CONFIG };
  },

  /** Analyze query and produce routing result */
  analyze,

  /** Compute combined final score */
  computeFinalScore,

  /** Compute text relevance score */
  computeRelevanceScore,

  /** Check if provider matches geo context (delegates to GeoEngine) */
  matchesGeo,

  /** Compute geo score for a provider (delegates to GeoEngine) */
  providerGeoScore,

  /** Log final score telemetry */
  trackFinalScore(query: string, intent: SearchIntent, resultCount: number) {
    silTrack('sil_final_score', {
      query,
      intent,
      resultCount: String(resultCount),
    });
  },

  /** Reload config from Governance Engine */
  async reloadFromGovernance() {
    _governanceLoaded = false;
    await loadGovernanceConfig();
  },
};

export default SearchIntelligence;
